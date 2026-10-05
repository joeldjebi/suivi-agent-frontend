import { SupportStatus, type SupportTicketInfo } from '@suivi/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Building2, Inbox, Loader2, Send } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { SupportStatusPill } from '@/features/support/SupportPage'
import { TicketThread } from '@/features/support/TicketThread'
import { formatRelative } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { supportCategoryLabel } from '@/lib/support'
import { cn } from '@/lib/utils'
import { platformApi } from '../api'
import { to } from '../config'

interface InboxRow {
  id: string
  number: number
  subject: string
  category: SupportTicketInfo['category']
  status: SupportStatus
  lastMessageAt: string
  lastAuthor: 'tenant' | 'platform'
  tenantId: string
  tenantName: string
  firstName: string | null
  lastName: string | null
  role: string | null
  messages: number
}

type Detail = SupportTicketInfo & { tenant: { id: string; name: string }; context: Record<string, string> }

const ROLE: Record<string, string> = { admin: 'administrateur', team_lead: 'chef d’équipe' }

/** Boîte de support : demandes de toutes les structures, en attente d'abord. */
export function SupportPage() {
  const [status, setStatus] = useState<string>(SupportStatus.Open)
  const [selected, setSelected] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const inbox = useQuery({
    queryKey: ['platform', 'support', status],
    placeholderData: keepPreviousData,
    queryFn: async () => (await platformApi.get<{ open: number; items: InboxRow[] }>('/support', { params: { status } })).data,
    refetchInterval: 60_000,
  })
  const detail = useQuery({
    queryKey: ['platform', 'support', 'ticket', selected],
    enabled: !!selected,
    queryFn: async () => (await platformApi.get<Detail>(`/support/${selected}`)).data,
  })
  const reply = useApiMutation(() => platformApi.post(`/support/${selected}/messages`, { body: body.trim() }), {
    success: 'Réponse envoyée : la structure est prévenue',
    invalidate: [['platform', 'support']],
    onSuccess: () => setBody(''),
  })
  const setTicketStatus = useApiMutation((next: SupportStatus) => platformApi.patch(`/support/${selected}`, { status: next }), {
    success: 'Statut mis à jour',
    invalidate: [['platform', 'support']],
  })
  const items = inbox.data?.items ?? []
  const t = detail.data

  return (
    <Page>
      <PageHeader title="Support" description="Demandes d’aide des structures. Répondez dans le fil : l’auteur reçoit une notification." />
      <Tabs value={status} onValueChange={(v) => setStatus(v as string)}>
        <TabsList>
          <TabsTrigger value={SupportStatus.Open}>En attente{inbox.data ? ` (${inbox.data.open})` : ''}</TabsTrigger>
          <TabsTrigger value={SupportStatus.Answered}>Répondues</TabsTrigger>
          <TabsTrigger value={SupportStatus.Closed}>Fermées</TabsTrigger>
          <TabsTrigger value="all">Toutes</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid gap-4 lg:grid-cols-[minmax(20rem,26rem)_1fr]">
        <QueryState query={inbox}>
          {items.length === 0 ? (
            <EmptyState icon={Inbox} title="Aucune demande" description="Rien dans cette catégorie." />
          ) : (
            <ul className="flex flex-col divide-y self-start rounded-lg border bg-card">
              {items.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r.id)}
                    aria-current={r.id === selected}
                    className={cn(
                      'flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none',
                      r.id === selected && 'bg-sidebar-accent hover:bg-sidebar-accent',
                    )}
                  >
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="tabular-nums">#{r.number}</span>· {r.tenantName}
                      <span className="ml-auto">{formatRelative(r.lastMessageAt)}</span>
                    </span>
                    <span
                      className={cn(
                        'truncate text-sm',
                        r.lastAuthor === 'tenant' && r.status === SupportStatus.Open ? 'font-semibold' : 'font-medium',
                      )}
                    >
                      {r.subject}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {supportCategoryLabel[r.category]} · {r.firstName} {r.lastName} · {r.messages} message{r.messages > 1 ? 's' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </QueryState>

        <section className="flex min-w-0 flex-col gap-4 self-start rounded-lg border bg-card p-4" aria-label="Demande">
          {!selected ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Choisissez une demande pour la lire et y répondre.</p>
          ) : (
            <QueryState query={detail}>
              {t && (
                <>
                  <header className="flex flex-wrap items-start justify-between gap-2 border-b pb-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        #{t.number} · {supportCategoryLabel[t.category]}
                      </p>
                      <h2 className="text-lg font-semibold">{t.subject}</h2>
                      <Link
                        to={to(`/tenants/${t.tenant.id}`)}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <Building2 className="size-3.5" aria-hidden /> {t.tenant.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {t.createdBy ? `${t.createdBy.firstName} ${t.createdBy.lastName}` : 'Compte supprimé'}
                        {t.context.role && ` (${ROLE[t.context.role] ?? t.context.role})`}
                        {t.context.plan && ` · formule ${t.context.plan}`}
                        {t.context.page && ` · depuis ${t.context.page}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <SupportStatusPill status={t.status} />
                      {t.status !== SupportStatus.Closed ? (
                        <Button size="sm" variant="outline" onClick={() => setTicketStatus.mutate(SupportStatus.Closed)}>
                          Fermer
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setTicketStatus.mutate(SupportStatus.Open)}>
                          Rouvrir
                        </Button>
                      )}
                    </div>
                  </header>
                  <TicketThread messages={t.messages ?? []} mine="platform" />
                  <div className="flex flex-col gap-2 border-t pt-3">
                    <Textarea
                      aria-label="Réponse"
                      rows={4}
                      value={body}
                      maxLength={5000}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Votre réponse…"
                    />
                    <Button className="self-end" disabled={!body.trim() || reply.isPending} onClick={() => reply.mutate(undefined)}>
                      {reply.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
                      Répondre
                    </Button>
                  </div>
                </>
              )}
            </QueryState>
          )}
        </section>
      </div>
    </Page>
  )
}
