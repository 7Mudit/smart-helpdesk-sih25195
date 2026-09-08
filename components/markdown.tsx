import * as React from 'react'
import { cn } from '@/lib/utils'

/*
  A deliberately small markdown renderer.

  The KB bodies are authored in-house and cover a known subset — headings,
  bold/italic, inline and fenced code, bullet and numbered lists, pipe tables,
  blockquotes, links and paragraphs. Rendering them here keeps the app
  dependency-free and offline-capable (a hard constraint in SPEC §6), and means
  no HTML is ever injected: every node below is a real React element, so an
  article body cannot smuggle markup into the page.
*/

// ------------------------------------------------------------------ inline

type Segment = React.ReactNode

/** Splits on the first matching delimiter, recursing into both sides. */
function renderInline(text: string, keyPrefix = 'i'): Segment[] {
  const out: Segment[] = []
  let rest = text
  let key = 0

  // Ordered by precedence: code first so its contents are never re-parsed.
  const patterns: {
    re: RegExp
    render: (m: RegExpExecArray, k: string) => React.ReactNode
  }[] = [
    {
      re: /`([^`]+)`/,
      render: (m, k) => (
        <code
          key={k}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {m[1]}
        </code>
      ),
    },
    {
      re: /\[([^\]]+)\]\(([^)\s]+)\)/,
      render: (m, k) => (
        <a
          key={k}
          href={m[2]}
          className="font-medium text-primary underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {renderInline(m[1] ?? '', `${k}-a`)}
        </a>
      ),
    },
    {
      re: /\*\*([^*]+)\*\*/,
      render: (m, k) => (
        <strong key={k} className="font-semibold text-foreground">
          {renderInline(m[1] ?? '', `${k}-b`)}
        </strong>
      ),
    },
    {
      re: /(?<![*\w])\*([^*\n]+)\*(?!\w)/,
      render: (m, k) => (
        <em key={k} className="italic">
          {renderInline(m[1] ?? '', `${k}-e`)}
        </em>
      ),
    },
  ]

  outer: while (rest.length > 0) {
    let best: { index: number; match: RegExpExecArray; idx: number } | null = null

    for (let p = 0; p < patterns.length; p++) {
      const match = patterns[p]!.re.exec(rest)
      if (match && (best === null || match.index < best.index)) {
        best = { index: match.index, match, idx: p }
      }
    }

    if (!best) break outer

    if (best.index > 0) out.push(rest.slice(0, best.index))
    out.push(patterns[best.idx]!.render(best.match, `${keyPrefix}-${key++}`))
    rest = rest.slice(best.index + best.match[0].length)
  }

  if (rest.length > 0) out.push(rest)
  return out
}

// ------------------------------------------------------------------- block

interface MarkdownProps {
  content: string
  className?: string
}

export function Markdown({ content, className }: MarkdownProps) {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []

  let i = 0
  let key = 0
  const k = () => `b-${key++}`

  while (i < lines.length) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()

    // blank
    if (trimmed === '') {
      i++
      continue
    }

    // fenced code
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim()
      const body: string[] = []
      i++
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith('```')) {
        body.push(lines[i] ?? '')
        i++
      }
      i++ // closing fence
      blocks.push(
        <pre
          key={k()}
          className="overflow-x-auto scrollbar-thin rounded-lg border border-border bg-muted/60 p-4 text-xs leading-6"
        >
          <code className="font-mono text-foreground" data-language={lang || undefined}>
            {body.join('\n')}
          </code>
        </pre>
      )
      continue
    }

    // heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed)
    if (heading) {
      const level = heading[1]!.length
      const text = heading[2] ?? ''
      const styles: Record<number, string> = {
        1: 'mt-8 text-2xl font-semibold tracking-tight first:mt-0',
        2: 'mt-8 text-xl font-semibold tracking-tight first:mt-0',
        3: 'mt-6 text-lg font-semibold tracking-tight first:mt-0',
        4: 'mt-6 text-base font-semibold first:mt-0',
        5: 'mt-4 text-sm font-semibold first:mt-0',
        6: 'mt-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground first:mt-0',
      }
      const Tag = `h${Math.min(level + 1, 6)}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      blocks.push(
        <Tag key={k()} className={cn('text-foreground', styles[level])}>
          {renderInline(text)}
        </Tag>
      )
      i++
      continue
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={k()} className="my-6 border-border" />)
      i++
      continue
    }

    // table — a header row followed by a separator row of dashes/pipes
    if (
      trimmed.startsWith('|') &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1] ?? '')
    ) {
      const header = splitRow(trimmed)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('|')) {
        rows.push(splitRow((lines[i] ?? '').trim()))
        i++
      }
      blocks.push(
        <div
          key={k()}
          className="my-6 w-full overflow-x-auto scrollbar-thin rounded-lg border border-border"
        >
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/60">
              <tr>
                {header.map((cell, ci) => (
                  <th
                    key={ci}
                    scope="col"
                    className="border-b border-border px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {renderInline(cell, `th-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-2.5 align-top text-foreground">
                      {renderInline(cell, `td-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // blockquote
    if (trimmed.startsWith('>')) {
      const body: string[] = []
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('>')) {
        body.push((lines[i] ?? '').trim().replace(/^>\s?/, ''))
        i++
      }
      blocks.push(
        <blockquote
          key={k()}
          className="my-4 border-l-4 border-primary/40 bg-muted/40 px-4 py-3 text-sm italic leading-6 text-muted-foreground"
        >
          {renderInline(body.join(' '))}
        </blockquote>
      )
      continue
    }

    // unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*+]\s+/.test((lines[i] ?? '').trim())) {
        items.push((lines[i] ?? '').trim().replace(/^[-*+]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={k()} className="my-4 flex list-disc flex-col gap-2 pl-6 text-sm leading-6">
          {items.map((item, ii) => (
            <li key={ii} className="text-foreground marker:text-muted-foreground">
              {renderInline(item, `ul-${ii}`)}
            </li>
          ))}
        </ul>
      )
      continue
    }

    // ordered list
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = []
      const start = Number.parseInt(trimmed, 10) || 1
      while (i < lines.length && /^\d+[.)]\s+/.test((lines[i] ?? '').trim())) {
        items.push((lines[i] ?? '').trim().replace(/^\d+[.)]\s+/, ''))
        i++
      }
      blocks.push(
        <ol
          key={k()}
          start={start}
          className="my-4 flex list-decimal flex-col gap-2 pl-6 text-sm leading-6"
        >
          {items.map((item, ii) => (
            <li key={ii} className="text-foreground marker:text-muted-foreground">
              {renderInline(item, `ol-${ii}`)}
            </li>
          ))}
        </ol>
      )
      continue
    }

    // paragraph — consume until a blank line or the start of another block
    const para: string[] = []
    while (i < lines.length) {
      const current = (lines[i] ?? '').trim()
      if (
        current === '' ||
        current.startsWith('```') ||
        current.startsWith('#') ||
        current.startsWith('>') ||
        current.startsWith('|') ||
        /^[-*+]\s+/.test(current) ||
        /^\d+[.)]\s+/.test(current)
      ) {
        break
      }
      para.push(current)
      i++
    }
    blocks.push(
      <p key={k()} className="my-4 text-sm leading-7 text-foreground first:mt-0">
        {renderInline(para.join(' '))}
      </p>
    )
  }

  return <div className={cn('max-w-none', className)}>{blocks}</div>
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

export default Markdown
