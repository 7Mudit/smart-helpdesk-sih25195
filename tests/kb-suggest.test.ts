import { describe, it, expect } from 'vitest'
import { suggestArticles } from '@/lib/automation/kb-suggest'

type Article = {
  id: string
  slug: string
  title: string
  body: string
  tags: string
  category: string
}

const articles: Article[] = [
  {
    id: 'a1',
    slug: 'reset-your-password',
    title: 'How to reset your password',
    body: 'Open the self service portal and choose reset. An OTP is sent to your registered mobile. Enter it and set a new password.',
    tags: 'password,reset,account,login',
    category: 'ACCESS',
  },
  {
    id: 'a2',
    slug: 'connect-to-vpn',
    title: 'Connecting to the office VPN',
    body: 'Install the VPN client, enter your domain credentials and select the nearest gateway. Check the firewall if the tunnel fails.',
    tags: 'vpn,network,remote',
    category: 'NETWORK',
  },
  {
    id: 'a3',
    slug: 'outlook-mailbox-quota',
    title: 'Outlook mailbox quota exceeded',
    body: 'Archive old mail to a local file to free space. The default mailbox quota is two gigabytes on the NIC mail server.',
    tags: 'outlook,email,mailbox,quota',
    category: 'EMAIL',
  },
  {
    id: 'a4',
    slug: 'sap-logon-gui',
    title: 'Installing SAP Logon GUI',
    body: 'Download the SAP GUI package from the software portal, run the installer and add the production system entry.',
    tags: 'sap,erp,gui,install',
    category: 'SAP_ERP',
  },
  {
    id: 'a5',
    slug: 'printer-toner-replacement',
    title: 'Replacing printer toner',
    body: 'Open the front panel of the printer, remove the empty cartridge and insert the new toner unit.',
    tags: 'printer,toner,hardware',
    category: 'HARDWARE',
  },
]

describe('suggestArticles — ranking', () => {
  it('ranks the password article first for a password query', () => {
    const out = suggestArticles('I forgot my password and need a reset', articles)
    expect(out[0]!.slug).toBe('reset-your-password')
  })

  it('ranks the VPN article first for a VPN query', () => {
    const out = suggestArticles('vpn client will not connect', articles)
    expect(out[0]!.slug).toBe('connect-to-vpn')
  })

  it('ranks the mailbox article first for a quota query', () => {
    const out = suggestArticles('outlook mailbox quota exceeded', articles)
    expect(out[0]!.slug).toBe('outlook-mailbox-quota')
  })

  it('ranks the SAP article first for a SAP GUI query', () => {
    const out = suggestArticles('sap logon gui install', articles)
    expect(out[0]!.slug).toBe('sap-logon-gui')
  })

  it('returns results sorted by descending score', () => {
    const out = suggestArticles('password reset vpn printer toner', articles, 5)
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1]!.score).toBeGreaterThanOrEqual(out[i]!.score)
    }
  })

  it('weights a title hit above a body-only hit', () => {
    const out = suggestArticles('toner', articles, 5)
    expect(out[0]!.slug).toBe('printer-toner-replacement')
  })

  it('carries id, slug and title on each suggestion', () => {
    const out = suggestArticles('password reset', articles)
    expect(out[0]).toMatchObject({ id: 'a1', slug: 'reset-your-password', title: 'How to reset your password' })
  })
})

describe('suggestArticles — limit', () => {
  it('defaults to at most 3 suggestions', () => {
    const out = suggestArticles('password vpn outlook sap printer reset toner install', articles)
    expect(out.length).toBeLessThanOrEqual(3)
  })

  it('honours an explicit limit', () => {
    const out = suggestArticles('password vpn outlook sap printer reset toner install', articles, 2)
    expect(out.length).toBe(2)
  })

  it('returns fewer than the limit when few articles match', () => {
    const out = suggestArticles('toner', articles, 5)
    expect(out.length).toBeGreaterThan(0)
    expect(out.length).toBeLessThan(5)
  })

  it('returns an empty array for a limit of zero', () => {
    expect(suggestArticles('password reset', articles, 0)).toEqual([])
  })
})

describe('suggestArticles — no-match and edge cases', () => {
  it('returns an empty array when nothing matches', () => {
    expect(suggestArticles('quantum chromodynamics seminar catering', articles)).toEqual([])
  })

  it('returns an empty array for an empty query', () => {
    expect(suggestArticles('', articles)).toEqual([])
  })

  it('returns an empty array for an empty article list', () => {
    expect(suggestArticles('password reset', [])).toEqual([])
  })

  it('returns an empty array when the query is only stopwords', () => {
    expect(suggestArticles('the and of a to is', articles)).toEqual([])
  })

  it('only returns suggestions with a score above zero', () => {
    const out = suggestArticles('printer toner', articles, 5)
    for (const s of out) {
      expect(s.score).toBeGreaterThan(0)
    }
  })

  it('is case and punctuation insensitive', () => {
    const a = suggestArticles('PASSWORD RESET!!!', articles)
    const b = suggestArticles('password reset', articles)
    expect(a.map((x) => x.slug)).toEqual(b.map((x) => x.slug))
  })

  it('handles a single-article corpus', () => {
    const out = suggestArticles('password reset', [articles[0]!])
    expect(out.length).toBe(1)
    expect(out[0]!.score).toBeGreaterThan(0)
  })

  it('produces a cosine score within the 0..1 range', () => {
    const out = suggestArticles('password reset account login', articles, 5)
    for (const s of out) {
      expect(s.score).toBeGreaterThan(0)
      expect(s.score).toBeLessThanOrEqual(1)
    }
  })

  it('matches on tags as well as title and body', () => {
    const out = suggestArticles('remote', articles, 5)
    expect(out[0]!.slug).toBe('connect-to-vpn')
  })
})
