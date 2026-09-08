// Duplicate detection for incoming tickets.
//
// Two cheap, complementary signals blended into one score:
//   - token-set Jaccard catches reworded tickets that share vocabulary
//     ("VPN not connecting" / "VPN connection fails"), but is blind to
//     morphology — "connecting" and "connection" are simply different tokens;
//   - character-bigram overlap catches exactly that, plus typos and
//     inflections, but is noisier on its own.
// 60/40 in favour of tokens keeps word-level evidence in charge while letting
// bigrams rescue near-misses.

import { DUPLICATE_SIMILARITY_THRESHOLD } from '@/lib/constants'

export interface DuplicateCandidate {
  ticketId: string
  ticketNumber: string
  title: string
  similarity: number
  status: string
}

const TOKEN_WEIGHT = 0.6
const BIGRAM_WEIGHT = 0.4

/**
 * English function words that appear in nearly every ticket and would inflate
 * similarity between unrelated pairs.
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'than', 'that', 'this',
  'these', 'those', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'doing', 'have', 'has', 'had', 'having', 'i', 'me',
  'my', 'mine', 'we', 'us', 'our', 'ours', 'you', 'your', 'yours', 'he',
  'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'they', 'them', 'their',
  'theirs', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'about', 'against',
  'between', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'from', 'up', 'down', 'out', 'off', 'over', 'under', 'again',
  'further', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
  'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'too', 'very', 'can',
  'will', 'just', 'should', 'would', 'could', 'may', 'might', 'must',
  'please', 'also', 'as', 'by', 'while',
])

/** Lowercase, strip punctuation, drop stopwords. */
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOPWORDS.has(token))
}

/** Jaccard index over the two token sets: |intersection| / |union|. */
function jaccard(a: Set<string>, b: Set<string>): number {
  let intersection = 0
  for (const token of a) {
    if (b.has(token)) intersection++
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

/** Character bigrams of the space-joined significant tokens. */
function bigrams(tokens: string[]): Set<string> {
  const joined = tokens.join(' ')
  const out = new Set<string>()
  for (let i = 0; i < joined.length - 1; i++) {
    out.add(joined.slice(i, i + 2))
  }
  return out
}

/**
 * Blended similarity of two free-text strings, 0..1.
 *
 * Identical strings (after normalisation) score exactly 1; anything with no
 * significant content on either side scores 0.
 */
export function similarity(a: string, b: string): number {
  const tokensA = tokenise(a)
  const tokensB = tokenise(b)

  // Nothing meaningful to compare on one or both sides.
  if (tokensA.length === 0 || tokensB.length === 0) return 0

  const tokenScore = jaccard(new Set(tokensA), new Set(tokensB))
  const bigramScore = jaccard(bigrams(tokensA), bigrams(tokensB))

  return TOKEN_WEIGHT * tokenScore + BIGRAM_WEIGHT * bigramScore
}

/**
 * Rank existing tickets by similarity to a draft, keeping those at or above
 * `threshold`, sorted most-similar first.
 *
 * The caller decides what to do with the result — the UI warns but never blocks
 * submission, because a false positive must not stop a real ticket being filed.
 */
export function findDuplicates(
  draft: { title: string; description: string },
  existing: Array<{
    id: string
    ticketNumber: string
    title: string
    description: string
    status: string
  }>,
  threshold: number = DUPLICATE_SIMILARITY_THRESHOLD,
): DuplicateCandidate[] {
  const draftText = `${draft.title} ${draft.description}`

  return existing
    .map((ticket) => ({
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      status: ticket.status,
      similarity: similarity(draftText, `${ticket.title} ${ticket.description}`),
    }))
    .filter((candidate) => candidate.similarity >= threshold && candidate.similarity > 0)
    .sort((x, y) => y.similarity - x.similarity)
}
