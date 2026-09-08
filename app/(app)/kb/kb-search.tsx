'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Label } from '@/components/ui/input'

export function KbSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [value, setValue] = React.useState(params.get('q') ?? '')

  React.useEffect(() => {
    setValue(params.get('q') ?? '')
  }, [params])

  function apply(next: string) {
    const qs = new URLSearchParams(params.toString())
    if (next) qs.set('q', next)
    else qs.delete('q')
    const s = qs.toString()
    router.push(s ? `${pathname}?${s}` : pathname)
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        apply(value.trim())
      }}
      className="w-full max-w-xl"
    >
      <Label htmlFor="kb-search" className="sr-only">
        Search knowledge-base articles
      </Label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id="kb-search"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search articles — VPN, password reset, SAP…"
          className="h-11 w-full rounded-md border border-input bg-card pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue('')
              apply('')
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </form>
  )
}
