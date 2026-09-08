import type { Metadata } from 'next'
import { NewTicketForm } from './new-ticket-form'

export const metadata: Metadata = { title: 'Raise a Ticket — Smart Helpdesk' }
export const dynamic = 'force-dynamic'

export default function NewTicketPage() {
  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Raise a Ticket</h1>
        <p className="text-sm text-muted-foreground">
          Describe the problem in your own words — classification, priority and routing happen
          automatically.
        </p>
      </div>

      <NewTicketForm />
    </div>
  )
}
