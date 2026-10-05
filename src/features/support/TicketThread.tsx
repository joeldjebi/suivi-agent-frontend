import type { SupportMessageInfo } from '@suivi/shared'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Fil d'une demande : les messages de « mine » à droite, ceux de l'autre partie à gauche.
 * Le texte est affiché tel quel (retours à la ligne gardés).
 */
export function TicketThread({ messages, mine }: { messages: SupportMessageInfo[]; mine: 'tenant' | 'platform' }) {
  return (
    <ol className="flex flex-col gap-3" aria-label="Messages">
      {messages.map((m) => {
        const own = m.authorKind === mine
        return (
          <li key={m.id} className={cn('flex flex-col gap-1', own ? 'items-end' : 'items-start')}>
            <div
              className={cn(
                'max-w-[min(42rem,92%)] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                own ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border bg-card',
              )}
            >
              {m.body}
            </div>
            <span className="px-1 text-xs text-muted-foreground">
              {m.authorName} · {formatDateTime(m.createdAt)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
