import { describe, it, expect } from 'vitest'
import { classifyTicket } from '@/lib/automation/classifier'
import { CLASSIFIER_CONFIDENCE_FLOOR, CATEGORIES, PRIORITIES } from '@/lib/constants'

describe('classifyTicket — category detection', () => {
  it('classifies a laptop not booting as HARDWARE', () => {
    const r = classifyTicket('Laptop not booting', 'My laptop shows a blue screen and will not start')
    expect(r.category).toBe('HARDWARE')
    expect(r.autoClassified).toBe(true)
  })

  it('classifies printer / toner issues as HARDWARE', () => {
    const r = classifyTicket('Printer toner empty', 'The printer cartridge needs replacement on 3rd floor')
    expect(r.category).toBe('HARDWARE')
  })

  it('classifies a monitor fault as HARDWARE', () => {
    const r = classifyTicket('Monitor flickering', 'The monitor and keyboard at my desktop are faulty')
    expect(r.category).toBe('HARDWARE')
  })

  it('classifies MS Office installation as SOFTWARE', () => {
    const r = classifyTicket('MS Office installation required', 'Please install ms office and adobe reader on my machine')
    expect(r.category).toBe('SOFTWARE')
  })

  it('classifies an application crash as SOFTWARE', () => {
    const r = classifyTicket('Application error on launch', 'The software keeps showing an application error and will freeze')
    expect(r.category).toBe('SOFTWARE')
  })

  it('classifies antivirus licence renewal as SOFTWARE', () => {
    const r = classifyTicket('Antivirus licence expired', 'Need a new license key for the antivirus, also a patch update')
    expect(r.category).toBe('SOFTWARE')
  })

  it('classifies VPN problems as NETWORK', () => {
    const r = classifyTicket('VPN not connecting', 'The vpn client fails and there is no connectivity to the office lan')
    expect(r.category).toBe('NETWORK')
  })

  it('classifies wifi trouble as NETWORK', () => {
    const r = classifyTicket('Wi-Fi keeps dropping', 'The wifi router in our wing drops the internet connection constantly')
    expect(r.category).toBe('NETWORK')
  })

  it('classifies DNS / proxy issues as NETWORK', () => {
    const r = classifyTicket('DNS resolution failing', 'Proxy and dns settings seem wrong, bandwidth is also poor')
    expect(r.category).toBe('NETWORK')
  })

  it('classifies a password reset as ACCESS', () => {
    const r = classifyTicket('Password reset needed', 'My account is locked, please reset the password and unlock my user id')
    expect(r.category).toBe('ACCESS')
  })

  it('classifies active directory permissions as ACCESS', () => {
    const r = classifyTicket('Active directory permission', 'Need access rights on the ad account, my credentials do not work')
    expect(r.category).toBe('ACCESS')
  })

  it('classifies SSO / OTP login failures as ACCESS', () => {
    const r = classifyTicket('SSO login failure', 'The sso otp never arrives so login is impossible')
    expect(r.category).toBe('ACCESS')
  })

  it('classifies an Outlook mailbox issue as EMAIL', () => {
    const r = classifyTicket('Outlook mailbox full', 'My mailbox quota is exceeded in outlook, cannot receive email')
    expect(r.category).toBe('EMAIL')
  })

  it('classifies NIC mail / SMTP problems as EMAIL', () => {
    const r = classifyTicket('NIC mail not syncing', 'The smtp mail server rejects my attachment and spam filter blocks it')
    expect(r.category).toBe('EMAIL')
  })

  it('classifies SAP transaction issues as SAP_ERP', () => {
    const r = classifyTicket('SAP tcode not working', 'The sap logon gui fails when I open the mm module t-code')
    expect(r.category).toBe('SAP_ERP')
  })

  it('classifies ERP purchase order workflow as SAP_ERP', () => {
    const r = classifyTicket('ERP purchase order stuck', 'The erp workflow for a purchase order in the fi module is stuck')
    expect(r.category).toBe('SAP_ERP')
  })

  it('classifies a phishing report as SECURITY', () => {
    const r = classifyTicket('Phishing email reported', 'Received a suspicious phishing mail, possible malware or virus')
    expect(r.category).toBe('SECURITY')
  })

  it('classifies a ransomware / breach report as SECURITY', () => {
    const r = classifyTicket('Ransomware detected', 'Suspected data leak and breach, machine may be hacked by cyber attackers')
    expect(r.category).toBe('SECURITY')
  })

  it('returns every category as a valid constant', () => {
    const r = classifyTicket('VPN down', 'vpn outage')
    expect(CATEGORIES).toContain(r.category)
    expect(PRIORITIES).toContain(r.priority)
  })
})

describe('classifyTicket — title weighting', () => {
  it('weights title matches double, so the title category wins a tie', () => {
    const titleOnly = classifyTicket('vpn vpn', 'unrelated words here')
    expect(titleOnly.category).toBe('NETWORK')
  })

  it('lets a strong title term outrank a single body term', () => {
    const r = classifyTicket('VPN firewall proxy dns', 'printer')
    expect(r.category).toBe('NETWORK')
  })
})

describe('classifyTicket — multi-word phrase matching', () => {
  it('matches the multi-word phrase "hard disk"', () => {
    const r = classifyTicket('Hard disk failure', 'The hard disk in my desktop is making noise')
    expect(r.category).toBe('HARDWARE')
    expect(r.matchedTerms).toContain('hard disk')
  })

  it('matches the multi-word phrase "active directory"', () => {
    const r = classifyTicket('Active directory issue', 'active directory account problem with access rights')
    expect(r.matchedTerms).toContain('active directory')
  })

  it('matches the multi-word phrase "purchase order"', () => {
    const r = classifyTicket('SAP purchase order', 'sap purchase order workflow')
    expect(r.matchedTerms).toContain('purchase order')
  })
})

describe('classifyTicket — priority from severity lexicon', () => {
  it('marks a production outage as CRITICAL', () => {
    const r = classifyTicket('SAP production down', 'Complete failure, server down, all users affected, urgent')
    expect(r.priority).toBe('CRITICAL')
  })

  it('marks data loss as CRITICAL', () => {
    const r = classifyTicket('Emergency data loss', 'There is data loss on the file server, we cannot work')
    expect(r.priority).toBe('CRITICAL')
  })

  it('marks blocked/asap wording as HIGH', () => {
    const r = classifyTicket('Blocked on SAP access', 'I am blocked, need this asap before the deadline')
    expect(r.priority).toBe('HIGH')
  })

  it('marks escalation wording as HIGH', () => {
    const r = classifyTicket('Please escalate printer repair', 'Need this urgently, escalate immediately')
    expect(r.priority).toBe('HIGH')
  })

  it('marks a how-to question as LOW', () => {
    const r = classifyTicket('Query about Outlook', 'Just a question, how to set an email signature, request for clarification')
    expect(r.priority).toBe('LOW')
  })

  it('defaults to MEDIUM with no severity signal', () => {
    const r = classifyTicket('Printer cartridge replacement', 'The printer cartridge and toner need replacing at some point')
    expect(r.priority).toBe('MEDIUM')
  })

  it('prefers CRITICAL over HIGH when both appear', () => {
    const r = classifyTicket('Server down and blocked', 'production down, blocked, asap')
    expect(r.priority).toBe('CRITICAL')
  })

  it('prefers HIGH over LOW when both appear', () => {
    const r = classifyTicket('Question but blocked', 'a query, however I am blocked on this deadline')
    expect(r.priority).toBe('HIGH')
  })
})

describe('classifyTicket — multi-user impact escalation', () => {
  it('escalates "whole department" to at least HIGH', () => {
    const r = classifyTicket('Printer issue', 'The whole department cannot print anything today')
    expect(r.priority).toBe('HIGH')
  })

  it('escalates "everyone in" to at least HIGH', () => {
    const r = classifyTicket('Outlook slow', 'everyone in the finance wing has a slow mailbox')
    expect(r.priority).toBe('HIGH')
  })

  it('escalates "entire team" to at least HIGH', () => {
    const r = classifyTicket('SAP login', 'the entire team cannot open sap logon gui')
    expect(r.priority).toBe('HIGH')
  })

  it('does not downgrade CRITICAL when a multi-user phrase is present', () => {
    const r = classifyTicket('Network outage', 'all users report an outage, the whole department is down')
    expect(r.priority).toBe('CRITICAL')
  })

  it('escalates a LOW-worded ticket with multi-user impact to HIGH', () => {
    const r = classifyTicket('Query on printer', 'just a question but all users in the entire team are impacted')
    expect(r.priority).toBe('HIGH')
  })

  // Real users describe breadth informally. These phrasings appear in genuine
  // tickets far more often than "multiple users are affected" does, and each
  // one was previously scored as a single-user report.
  it.each([
    ['colleagues', 'Three colleagues in the same office have the same issue'],
    ['same problem', 'My neighbour reports the same problem on their machine'],
    ['others are facing', 'I checked and others are facing it too'],
    ['several users', 'several users on this floor cannot log in'],
    ['same floor', 'people on the same floor are affected'],
    ['no one is able', 'no one is able to reach the shared drive'],
  ])('escalates informal multi-user phrasing: %s', (_label, description) => {
    const r = classifyTicket('Printer issue', description)
    expect(r.priority).toBe('HIGH')
  })

  it('leaves a genuinely single-user report at its base priority', () => {
    const r = classifyTicket('Printer issue', 'My printer is not printing. Please check when possible.')
    expect(r.priority).not.toBe('HIGH')
  })
})

describe('classifyTicket — confidence and fallback', () => {
  it('returns OTHER with zero confidence for empty input', () => {
    const r = classifyTicket('', '')
    expect(r.category).toBe('OTHER')
    expect(r.confidence).toBe(0)
    expect(r.autoClassified).toBe(false)
    expect(r.matchedTerms).toEqual([])
    expect(r.priority).toBe('MEDIUM')
  })

  it('returns OTHER for garbage input with no keyword hit', () => {
    const r = classifyTicket('zzzz qqqq', 'lorem ipsum dolor sit amet consectetur')
    expect(r.category).toBe('OTHER')
    expect(r.confidence).toBe(0)
    expect(r.autoClassified).toBe(false)
  })

  it('still derives priority from severity scan when the category is OTHER', () => {
    const r = classifyTicket('zzzz qqqq', 'this is an emergency, complete failure, we cannot work')
    expect(r.category).toBe('OTHER')
    expect(r.autoClassified).toBe(false)
    expect(r.priority).toBe('CRITICAL')
  })

  it('falls back to OTHER when confidence sits below the floor', () => {
    // One term from many different categories: the top score is a small
    // fraction of the total, so confidence lands under 0.35.
    const r = classifyTicket(
      '',
      'laptop install vpn password outlook sap phishing monitor excel wifi login mailbox erp malware',
    )
    expect(r.confidence).toBeLessThan(CLASSIFIER_CONFIDENCE_FLOOR)
    expect(r.category).toBe('OTHER')
    expect(r.autoClassified).toBe(false)
  })

  it('produces a confidence between 0 and 1 inclusive', () => {
    const r = classifyTicket('VPN down', 'the vpn is down and dns fails')
    expect(r.confidence).toBeGreaterThan(0)
    expect(r.confidence).toBeLessThanOrEqual(1)
  })

  it('gives confidence 1 when only one category matches', () => {
    const r = classifyTicket('VPN issue', 'vpn vpn vpn')
    expect(r.confidence).toBe(1)
    expect(r.autoClassified).toBe(true)
  })

  it('sets autoClassified true exactly when confidence meets the floor', () => {
    const r = classifyTicket('Password reset', 'please reset my password, account locked')
    expect(r.confidence).toBeGreaterThanOrEqual(CLASSIFIER_CONFIDENCE_FLOOR)
    expect(r.autoClassified).toBe(true)
  })
})

describe('classifyTicket — normalisation', () => {
  it('is case insensitive', () => {
    const upper = classifyTicket('VPN NOT CONNECTING', 'THE VPN AND DNS ARE DOWN')
    const lower = classifyTicket('vpn not connecting', 'the vpn and dns are down')
    expect(upper.category).toBe(lower.category)
    expect(upper.priority).toBe(lower.priority)
    expect(upper.confidence).toBe(lower.confidence)
  })

  it('ignores punctuation around keywords', () => {
    const r = classifyTicket('VPN, not connecting!!!', 'The (vpn) — is down; dns... fails?')
    expect(r.category).toBe('NETWORK')
  })

  it('treats wi-fi and wifi alike', () => {
    const hyphen = classifyTicket('Wi-Fi down', 'wi-fi is broken in the block')
    expect(hyphen.category).toBe('NETWORK')
  })

  it('collapses extra whitespace and newlines', () => {
    const r = classifyTicket('  Laptop   not\n\n booting  ', '\tThe   laptop\n will not boot\n')
    expect(r.category).toBe('HARDWARE')
  })
})

describe('classifyTicket — matchedTerms explainability', () => {
  it('reports the terms that drove the classification', () => {
    const r = classifyTicket('VPN down', 'the vpn and the firewall block internet access')
    expect(r.matchedTerms.length).toBeGreaterThan(0)
    expect(r.matchedTerms).toContain('vpn')
  })

  it('does not repeat a term that appears more than once', () => {
    const r = classifyTicket('vpn vpn vpn', 'vpn vpn')
    const unique = new Set(r.matchedTerms)
    expect(unique.size).toBe(r.matchedTerms.length)
  })

  it('reports only terms belonging to the winning category', () => {
    const r = classifyTicket('VPN firewall dns proxy router', 'vpn lan ethernet, minor printer note')
    expect(r.category).toBe('NETWORK')
    expect(r.matchedTerms).not.toContain('printer')
  })

  it('returns an empty matchedTerms list for the OTHER fallback', () => {
    const r = classifyTicket('zzzz', 'qqqq wwww')
    expect(r.matchedTerms).toEqual([])
  })
})
