// Deterministic keyword classifier for incoming tickets.
//
// No LLM, no network, no model download — a weighted lexicon scored over the
// ticket title and description. Title matches count double because the title is
// where a user states the actual problem. Every decision is explainable: the
// caller gets back the terms that drove it, so the UI can show *why* a ticket
// was filed as NETWORK rather than asking the user to trust a black box.

import {
  CLASSIFIER_CONFIDENCE_FLOOR,
  type Category,
  type Priority,
} from '@/lib/constants'

export interface ClassificationResult {
  category: Category
  priority: Priority
  /** topScore / totalScore across all categories, 0..1. Zero when nothing matched. */
  confidence: number
  /** False when confidence < CLASSIFIER_CONFIDENCE_FLOOR — a human must triage. */
  autoClassified: boolean
  /** Terms from the winning category that were found, for UI explainability. */
  matchedTerms: string[]
}

/** A keyword and how much a single occurrence contributes to its category. */
type Lexicon = Record<string, number>

// Weights: 3 = unambiguous for this category (a "vpn" ticket is a network
// ticket), 2 = strong, 1 = supporting evidence that needs company.
const CATEGORY_LEXICONS: Record<Exclude<Category, 'OTHER'>, Lexicon> = {
  HARDWARE: {
    laptop: 3,
    desktop: 3,
    monitor: 3,
    keyboard: 3,
    mouse: 2,
    printer: 3,
    scanner: 3,
    ups: 2,
    battery: 2,
    ram: 2,
    'hard disk': 3,
    harddisk: 3,
    motherboard: 3,
    cartridge: 3,
    toner: 3,
    'docking station': 3,
    projector: 3,
    'not booting': 3,
    'will not boot': 3,
    'blue screen': 3,
    keypad: 2,
    cpu: 2,
    'power supply': 2,
    hardware: 2,
    peripheral: 2,
  },
  SOFTWARE: {
    install: 2,
    installation: 2,
    reinstall: 2,
    licence: 2,
    license: 2,
    'ms office': 3,
    'microsoft office': 3,
    excel: 3,
    word: 2,
    powerpoint: 3,
    adobe: 3,
    acrobat: 3,
    antivirus: 3,
    update: 2,
    upgrade: 2,
    patch: 2,
    crash: 2,
    crashes: 2,
    freeze: 2,
    freezes: 2,
    hangs: 2,
    'application error': 3,
    software: 3,
    application: 2,
    driver: 2,
    compatibility: 2,
  },
  NETWORK: {
    vpn: 3,
    wifi: 3,
    'wi fi': 3,
    internet: 2,
    lan: 2,
    ethernet: 3,
    dns: 3,
    proxy: 2,
    firewall: 2,
    router: 3,
    switch: 2,
    bandwidth: 2,
    'slow network': 3,
    'no connectivity': 3,
    connectivity: 2,
    'ip address': 3,
    port: 2,
    network: 2,
    'network cable': 3,
    'leased line': 3,
    gateway: 2,
    ping: 2,
  },
  ACCESS: {
    password: 3,
    reset: 2,
    login: 3,
    logon: 2,
    account: 2,
    locked: 2,
    unlock: 3,
    permission: 2,
    permissions: 2,
    'access rights': 3,
    'active directory': 3,
    'ad account': 3,
    credentials: 3,
    sso: 3,
    otp: 3,
    'user id': 3,
    username: 2,
    authentication: 2,
    authorisation: 2,
    authorization: 2,
    'role assignment': 2,
  },
  EMAIL: {
    outlook: 3,
    email: 3,
    mail: 2,
    mailbox: 3,
    quota: 2,
    smtp: 3,
    imap: 3,
    pop3: 3,
    spam: 3,
    attachment: 2,
    'nic mail': 3,
    'mail server': 3,
    'distribution list': 3,
    inbox: 2,
    'email signature': 2,
    'out of office': 2,
    webmail: 3,
  },
  SAP_ERP: {
    sap: 3,
    erp: 3,
    'mm module': 3,
    'fi module': 3,
    'hr module': 3,
    tcode: 3,
    't code': 3,
    gui: 2,
    'sap logon': 3,
    'purchase order': 3,
    workflow: 2,
    abap: 3,
    'material master': 3,
    'goods receipt': 3,
    'cost centre': 2,
    'cost center': 2,
    netweaver: 3,
  },
  SECURITY: {
    phishing: 3,
    malware: 3,
    virus: 3,
    ransomware: 3,
    breach: 3,
    suspicious: 2,
    unauthorized: 3,
    unauthorised: 3,
    hacked: 3,
    'data leak': 3,
    cyber: 2,
    encryption: 2,
    vulnerability: 3,
    trojan: 3,
    spyware: 3,
    'security incident': 3,
    compromised: 3,
  },
}

const SEVERITY_LEXICONS: Record<'CRITICAL' | 'HIGH' | 'LOW', string[]> = {
  CRITICAL: [
    'down',
    'outage',
    'production down',
    // NOTE: breadth-of-impact phrases ("whole department", "all users",
    // "entire office") are deliberately NOT here. They live in
    // MULTI_USER_PHRASES and raise the floor to HIGH. Treating them as hard
    // CRITICAL would make the "at least HIGH" floor unreachable and would mark
    // "the whole department has a printing query" a CRITICAL incident. A
    // genuinely critical ticket says so on its own ("outage", "down",
    // "data loss") — and then CRITICAL wins anyway.
    'urgent',
    'emergency',
    'cannot work',
    'unable to work',
    'complete failure',
    'server down',
    'data loss',
    'total failure',
    'system down',
  ],
  HIGH: [
    'blocked',
    'asap',
    'deadline',
    'urgently',
    'escalate',
    'escalation',
    'multiple users',
    'team affected',
    'immediately',
    'high priority',
    'at the earliest',
  ],
  LOW: [
    'query',
    'question',
    'request',
    'whenever',
    'information',
    'how to',
    'clarification',
    'minor',
    'no rush',
    'at your convenience',
    'cosmetic',
  ],
}

/** Phrases implying more than one affected user — force at least HIGH. */
const MULTI_USER_PHRASES = [
  'whole department',
  'entire department',
  'everyone in',
  'all users',
  'entire team',
  'whole team',
  'entire office',
  'whole office',
  'multiple users',
  'all of us',
  'everybody in',
  // People rarely write "multiple users are affected" — they write "my
  // colleagues have the same problem". These informal phrasings signal the
  // same breadth of impact and were missing real multi-user reports.
  'colleagues',
  'same issue',
  'same problem',
  'others are facing',
  'others also',
  'few of us',
  'many of us',
  'several users',
  'other users',
  'same floor',
  'nobody is able',
  'no one is able',
]

/**
 * Lowercase, strip punctuation, collapse whitespace.
 *
 * Punctuation becomes a space rather than being deleted, so "wi-fi" normalises
 * to "wi fi" and "vpn,dns" does not fuse into one token. Lexicon keys are
 * written to match this normalised form.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Whether a normalised phrase occurs in normalised text, on token boundaries. */
function containsPhrase(haystack: string, phrase: string): boolean {
  if (phrase.length === 0) return false
  return ` ${haystack} `.includes(` ${phrase} `)
}

/**
 * Score one lexicon against the title and description.
 *
 * Both single words and multi-word phrases are handled by the same substring
 * check on token boundaries. A term counts once per field regardless of how
 * many times it repeats — repetition is emphasis, not extra evidence — and a
 * title hit is worth double a description hit.
 */
function scoreLexicon(
  lexicon: Lexicon,
  normTitle: string,
  normBody: string,
): { score: number; terms: string[] } {
  let score = 0
  const terms: string[] = []

  for (const [term, weight] of Object.entries(lexicon)) {
    const inTitle = containsPhrase(normTitle, term)
    const inBody = containsPhrase(normBody, term)
    if (!inTitle && !inBody) continue

    // Title matches count double.
    if (inTitle) score += weight * 2
    if (inBody) score += weight
    terms.push(term)
  }

  return { score, terms }
}

/** Highest severity band mentioned anywhere in the text; MEDIUM when silent. */
function scanSeverity(normText: string): Priority {
  for (const phrase of SEVERITY_LEXICONS.CRITICAL) {
    if (containsPhrase(normText, phrase)) return 'CRITICAL'
  }
  for (const phrase of SEVERITY_LEXICONS.HIGH) {
    if (containsPhrase(normText, phrase)) return 'HIGH'
  }
  for (const phrase of SEVERITY_LEXICONS.LOW) {
    if (containsPhrase(normText, phrase)) return 'LOW'
  }
  return 'MEDIUM'
}

/** True when the text implies more than one affected user. */
function hasMultiUserImpact(normText: string): boolean {
  return MULTI_USER_PHRASES.some((phrase) => containsPhrase(normText, phrase))
}

/** Derive priority: severity scan, floored at HIGH for multi-user impact. */
function derivePriority(normText: string): Priority {
  const severity = scanSeverity(normText)
  if (severity === 'CRITICAL') return 'CRITICAL'
  if (hasMultiUserImpact(normText)) return 'HIGH'
  return severity
}

/**
 * Classify a ticket from its title and description.
 *
 * Returns `OTHER` with `autoClassified: false` when nothing matches or when the
 * winning category is not a clear enough favourite (confidence below
 * CLASSIFIER_CONFIDENCE_FLOOR). Priority is still derived in that case, since
 * severity wording is independent of the category — honest degradation rather
 * than fake certainty.
 */
export function classifyTicket(title: string, description: string): ClassificationResult {
  const normTitle = normalise(title)
  const normBody = normalise(description)
  const combined = normalise(`${title} ${description}`)

  const priority = derivePriority(combined)

  let topCategory: Category = 'OTHER'
  let topScore = 0
  let topTerms: string[] = []
  let totalScore = 0

  for (const [category, lexicon] of Object.entries(CATEGORY_LEXICONS)) {
    const { score, terms } = scoreLexicon(lexicon, normTitle, normBody)
    totalScore += score
    if (score > topScore) {
      topScore = score
      topCategory = category as Category
      topTerms = terms
    }
  }

  const confidence = totalScore > 0 ? topScore / totalScore : 0

  // No keyword hit at all, or the winner is not a clear enough favourite.
  if (topScore === 0 || confidence < CLASSIFIER_CONFIDENCE_FLOOR) {
    return {
      category: 'OTHER',
      priority,
      confidence,
      autoClassified: false,
      matchedTerms: [],
    }
  }

  return {
    category: topCategory,
    priority,
    confidence,
    autoClassified: true,
    matchedTerms: topTerms,
  }
}
