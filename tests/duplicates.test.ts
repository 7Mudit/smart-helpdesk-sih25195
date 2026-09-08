import { describe, it, expect } from 'vitest'
import { similarity, findDuplicates } from '@/lib/automation/duplicates'
import { DUPLICATE_SIMILARITY_THRESHOLD } from '@/lib/constants'

type Existing = {
  id: string
  ticketNumber: string
  title: string
  description: string
  status: string
}

const corpus: Existing[] = [
  {
    id: 't1',
    ticketNumber: 'MOP-2026-00031',
    title: 'VPN not connecting from home',
    description: 'The VPN client fails to connect when I work from home over broadband',
    status: 'OPEN',
  },
  {
    id: 't2',
    ticketNumber: 'MOP-2026-00032',
    title: 'Printer toner replacement needed',
    description: 'The printer on the third floor is out of toner and needs a new cartridge',
    status: 'IN_PROGRESS',
  },
  {
    id: 't3',
    ticketNumber: 'MOP-2026-00033',
    title: 'SAP purchase order workflow stuck',
    description: 'A purchase order in the SAP MM module is stuck in the approval workflow',
    status: 'OPEN',
  },
]

describe('similarity', () => {
  it('returns 1 for identical strings', () => {
    expect(similarity('vpn not connecting', 'vpn not connecting')).toBe(1)
  })

  it('returns 1 for identical strings ignoring case and punctuation', () => {
    expect(similarity('VPN Not Connecting!', 'vpn, not connecting')).toBe(1)
  })

  it('returns 0 when the first string is empty', () => {
    expect(similarity('', 'vpn not connecting')).toBe(0)
  })

  it('returns 0 when the second string is empty', () => {
    expect(similarity('vpn not connecting', '')).toBe(0)
  })

  it('returns 0 when both strings are empty', () => {
    expect(similarity('', '')).toBe(0)
  })

  it('returns 0 when a string is only stopwords', () => {
    expect(similarity('the and of a', 'vpn connection failure')).toBe(0)
  })

  it('scores completely unrelated text far below the duplicate threshold', () => {
    // Not exactly 0: unrelated English still shares incidental character
    // bigrams. What matters is that the score is nowhere near the threshold.
    const s = similarity('printer toner cartridge', 'sap purchase order workflow')
    expect(s).toBeLessThan(0.1)
    expect(s).toBeLessThan(DUPLICATE_SIMILARITY_THRESHOLD)
  })

  it('scores paraphrases above unrelated text', () => {
    const near = similarity('vpn not connecting from home', 'vpn connection fails from home')
    const far = similarity('vpn not connecting from home', 'printer needs a new toner cartridge')
    expect(near).toBeGreaterThan(far)
  })

  it('ignores stopwords when comparing', () => {
    const withStop = similarity('the vpn is not connecting', 'a vpn that is not connecting')
    expect(withStop).toBe(1)
  })

  it('stays within the 0..1 range', () => {
    const s = similarity('vpn client failure on laptop', 'vpn client fails on the laptop')
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThanOrEqual(1)
  })

  it('is symmetric', () => {
    const a = 'password reset for my account'
    const b = 'reset the password on this account please'
    expect(similarity(a, b)).toBeCloseTo(similarity(b, a), 10)
  })

  it('gives partial credit for shared character bigrams without shared tokens', () => {
    // "connecting" vs "connection": no token overlap, but heavy bigram overlap.
    const s = similarity('connecting', 'connection')
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThan(1)
  })
})

describe('findDuplicates', () => {
  it('finds a near-identical ticket', () => {
    const out = findDuplicates(
      {
        title: 'VPN not connecting from home',
        description: 'The VPN client fails to connect when I work from home over broadband',
      },
      corpus,
    )
    expect(out.length).toBeGreaterThan(0)
    expect(out[0]!.ticketNumber).toBe('MOP-2026-00031')
    expect(out[0]!.similarity).toBeGreaterThanOrEqual(DUPLICATE_SIMILARITY_THRESHOLD)
  })

  it('returns candidates carrying id, number, title and status', () => {
    const out = findDuplicates(
      {
        title: 'VPN not connecting from home',
        description: 'The VPN client fails to connect when I work from home over broadband',
      },
      corpus,
    )
    expect(out[0]).toMatchObject({
      ticketId: 't1',
      ticketNumber: 'MOP-2026-00031',
      title: 'VPN not connecting from home',
      status: 'OPEN',
    })
  })

  it('returns an empty array for an empty corpus', () => {
    const out = findDuplicates({ title: 'VPN not connecting', description: 'vpn fails' }, [])
    expect(out).toEqual([])
  })

  it('returns an empty array when nothing is similar enough', () => {
    const out = findDuplicates(
      { title: 'Chair is broken', description: 'The office chair in my cabin has a broken wheel' },
      corpus,
    )
    expect(out).toEqual([])
  })

  it('returns an empty array for an empty draft', () => {
    const out = findDuplicates({ title: '', description: '' }, corpus)
    expect(out).toEqual([])
  })

  it('sorts results by descending similarity', () => {
    const out = findDuplicates(
      {
        title: 'VPN not connecting from home',
        description: 'vpn client fails printer toner cartridge sap purchase order workflow',
      },
      corpus,
      0,
    )
    expect(out.length).toBe(3)
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1]!.similarity).toBeGreaterThanOrEqual(out[i]!.similarity)
    }
  })

  it('honours an explicit threshold', () => {
    // A paraphrase, not a verbatim copy: an exact copy scores 1.0 and would
    // clear even a 0.99 threshold, so the comparison would prove nothing.
    const draft = {
      title: 'Cannot connect to VPN from residence',
      description: 'VPN client will not connect while working from home',
    }
    expect(findDuplicates(draft, corpus, 0.99).length).toBeLessThan(
      findDuplicates(draft, corpus, 0.1).length,
    )
  })

  it('uses DUPLICATE_SIMILARITY_THRESHOLD by default', () => {
    const draft = {
      title: 'VPN not connecting from home',
      description: 'The VPN client fails to connect when I work from home over broadband',
    }
    expect(findDuplicates(draft, corpus)).toEqual(
      findDuplicates(draft, corpus, DUPLICATE_SIMILARITY_THRESHOLD),
    )
  })

  it('scores a paraphrased duplicate above an unrelated ticket', () => {
    const out = findDuplicates(
      {
        title: 'Cannot connect to VPN from residence',
        description: 'VPN client will not connect while working from home',
      },
      corpus,
      0,
    )
    expect(out[0]!.ticketNumber).toBe('MOP-2026-00031')
  })

  it('never returns a similarity above 1', () => {
    const out = findDuplicates(
      { title: corpus[0]!.title, description: corpus[0]!.description },
      corpus,
      0,
    )
    for (const c of out) {
      expect(c.similarity).toBeLessThanOrEqual(1)
    }
  })
})
