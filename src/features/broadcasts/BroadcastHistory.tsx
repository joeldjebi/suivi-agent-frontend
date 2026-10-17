import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  BellRing,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Eye,
  History,
  Loader2,
  RotateCw,
  Smartphone,
  SmartphoneNfc,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { EmptyState, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { SearchInput } from '@/components/app/search-input'
import { StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { roleLabel } from '@/lib/labels'
import { useApiMutation } from '@/lib/queries'
import type { Page as PageOf } from '@/lib/types'

type BroadcastStatus = 'sent' | 'partial' | 'failed' | 'pending' | 'legacy'
type DeliveryStatus = 'sent' | 'failed' | 'no_device' | 'pending'

export interface BroadcastRow {
  id: string
  title: string
  body: string
  audience: unknown
  recipients: number
  reachable: number
  createdAt: string
  authorName: string | null
  status: BroadcastStatus
  sent: number
  failed: number
  noDevice: number
  pending: number
  read: number
}

interface Recipient {
  userId: string
  name: string
  role: string
  status: DeliveryStatus | null
  errorCode: string | null
  attempts: number
  lastAttemptAt: string | null
  readAt: string | null
}

interface BroadcastDetail {
  id: string
  title: string
  body: string
  createdAt: string
  authorName: string | null
  recipients: Recipient[]
}

type Tone = 'active' | 'paused' | 'alert' | 'ended' | 'info'

const STATUS: Record<BroadcastStatus, [Tone, LucideIcon, string]> = {
  sent: ['active', CheckCircle2, 'Envoyé'],
  partial: ['paused', SmartphoneNfc, 'Partiel'],
  failed: ['alert', XCircle, 'Échec'],
  pending: ['info', CircleDashed, 'En cours'],
  legacy: ['ended', History, 'Ancien envoi'],
}

const DELIVERY: Record<DeliveryStatus, [Tone, LucideIcon, string]> = {
  sent: ['active', Smartphone, 'Envoyé au téléphone'],
  failed: ['alert', XCircle, 'Échec'],
  no_device: ['ended', CircleDashed, 'Pas de téléphone'],
  pending: ['info', Loader2, 'En cours'],
}

/** Raison d'un échec, en clair (codes de Firebase et du serveur). */
function failureReason(code: string | null): string {
  switch (code) {
    case 'messaging/registration-token-not-registered':
      return 'Application désinstallée ou téléphone changé'
    case 'messaging/invalid-registration-token':
      return 'Téléphone non reconnu'
    case 'messaging/third-party-auth-error':
      return 'Refusé par Apple (réglages des notifications iPhone)'
    case 'messaging/mismatched-credential':
      return 'Réglages des notifications incorrects'
    case 'push_not_in_plan':
      return 'Non inclus dans votre formule'
    case 'push_unavailable':
      return 'Notifications momentanément indisponibles'
    default:
      return 'Envoi impossible, réessayez'
  }
}

const FILTERS: { value: BroadcastStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'sent', label: 'Envoyés' },
  { value: 'partial', label: 'Partiels' },
  { value: 'failed', label: 'Échecs' },
]

const PAGE_SIZE = 20

/**
 * Envois précédents : statut de chaque envoi (envoyé, partiel, échec), compteurs par
 * destinataire, et détail avec renvoi aux personnes choisies.
 */
export function BroadcastHistory({ audienceSummary }: { audienceSummary: (audience: never) => string }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<BroadcastStatus | 'all'>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const history = useQuery({
    queryKey: ['broadcasts', 'history', { page, search, status }],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await api.get<PageOf<BroadcastRow>>('/broadcasts', {
          params: { page, limit: PAGE_SIZE, q: search.trim() || undefined, status: status === 'all' ? undefined : status },
        })
      ).data,
    // Envoi en cours : le suivi arrive quelques secondes après.
    refetchInterval: (q) => (q.state.data?.items.some((b) => b.status === 'pending') ? 2000 : false),
  })
  const data = history.data
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-base font-semibold">Envois précédents</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1" role="group" aria-label="Filtrer par statut">
            {FILTERS.map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={status === f.value ? 'default' : 'outline'}
                aria-pressed={status === f.value}
                onClick={() => {
                  setStatus(f.value)
                  setPage(1)
                }}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v)
              setPage(1)
            }}
            placeholder="Rechercher un titre"
            label="Rechercher un envoi"
          />
        </div>
      </div>
      <QueryState query={history}>
        {data?.items.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title={search || status !== 'all' ? 'Aucun envoi ne correspond' : 'Aucune notification envoyée'}
            description={search || status !== 'all' ? 'Changez la recherche ou le filtre.' : 'Vos envois apparaîtront ici.'}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Notification</TableHead>
                  <TableHead>Destinataires</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Suivi</TableHead>
                  <TableHead>
                    <span className="sr-only">Détail</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((b) => {
                  const [tone, icon, label] = STATUS[b.status]
                  return (
                    <TableRow key={b.id} className="cursor-pointer" onClick={() => setOpenId(b.id)}>
                      <TableCell className="align-top text-sm whitespace-nowrap">
                        {formatDateTime(b.createdAt)}
                        <div className="text-xs text-muted-foreground">{b.authorName ?? ''}</div>
                      </TableCell>
                      <TableCell className="max-w-md align-top">
                        <div className="font-medium">{b.title}</div>
                        <div className="line-clamp-2 text-sm whitespace-normal text-muted-foreground">{b.body}</div>
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        {audienceSummary(b.audience as never)}
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {b.recipients} personne{b.recipients > 1 ? 's' : ''}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <StatusPill tone={tone} icon={icon} label={label} />
                      </TableCell>
                      <TableCell className="align-top text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        {b.status === 'legacy' ? (
                          <div>{b.reachable} sur téléphone</div>
                        ) : (
                          <>
                            <div>
                              {b.sent} envoyé{b.sent > 1 ? 's' : ''}
                            </div>
                            {b.failed > 0 && <div className="text-status-alert">{b.failed} en échec</div>}
                            {b.noDevice > 0 && <div>{b.noDevice} sans téléphone</div>}
                          </>
                        )}
                        <div>
                          {b.read} lu{b.read > 1 ? 's' : ''}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Button variant="ghost" size="icon-sm" aria-label={`Voir le détail de « ${b.title} »`}>
                          <ChevronRight aria-hidden />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {data && <Pagination page={page} pages={pages} total={data.total} pageSize={data.limit} onPage={setPage} />}
      </QueryState>
      <BroadcastSheet id={openId} onClose={() => setOpenId(null)} />
    </section>
  )
}

type RecipientFilter = 'all' | 'failed' | 'no_device' | 'unread'

const RECIPIENT_FILTERS: { value: RecipientFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'failed', label: 'Échecs' },
  { value: 'no_device', label: 'Sans téléphone' },
  { value: 'unread', label: 'Non lus' },
]

/** Détail d'un envoi : état par destinataire, sélection et renvoi. */
function BroadcastSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 data-[side=right]:sm:max-w-2xl">{id && <BroadcastDetailView key={id} id={id} />}</SheetContent>
    </Sheet>
  )
}

function BroadcastDetailView({ id }: { id: string }) {
  const [filter, setFilter] = useState<RecipientFilter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const detail = useQuery({
    queryKey: ['broadcasts', 'detail', id],
    queryFn: async () => (await api.get<BroadcastDetail>(`/broadcasts/${id}`)).data,
    refetchInterval: (q) => (q.state.data?.recipients.some((r) => r.status === 'pending') ? 2000 : false),
  })
  const resend = useApiMutation((userIds: string[]) => api.post<{ resent: number }>(`/broadcasts/${id}/resend`, { userIds }), {
    success: 'Notification renvoyée',
    invalidate: [['broadcasts']],
    onSuccess: () => setSelected(new Set()),
  })
  const d = detail.data
  const shown =
    d?.recipients.filter((r) =>
      filter === 'all'
        ? true
        : filter === 'unread'
          ? !r.readAt
          : filter === 'failed'
            ? r.status === 'failed'
            : r.status === 'no_device' || r.status === null,
    ) ?? []
  const toggle = (userId: string, on: boolean) => {
    const next = new Set(selected)
    if (on) next.add(userId)
    else next.delete(userId)
    setSelected(next)
  }
  const allShown = shown.length > 0 && shown.every((r) => selected.has(r.userId))

  return (
    <>
      <SheetHeader>
        <SheetTitle>{d?.title ?? 'Envoi'}</SheetTitle>
        <SheetDescription>{d ? `${formatDateTime(d.createdAt)}${d.authorName ? ` · ${d.authorName}` : ''}` : ''}</SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4">
        <QueryState query={detail}>
          {d && (
            <>
              <p className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-line">{d.body}</p>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrer les destinataires">
                {RECIPIENT_FILTERS.map((f) => (
                  <Button
                    key={f.value}
                    size="xs"
                    variant={filter === f.value ? 'default' : 'outline'}
                    aria-pressed={filter === f.value}
                    onClick={() => setFilter(f.value)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox
                          aria-label="Tout sélectionner"
                          checked={allShown}
                          disabled={!shown.length}
                          onCheckedChange={(c) => setSelected(c ? new Set([...selected, ...shown.map((r) => r.userId)]) : new Set())}
                        />
                      </TableHead>
                      <TableHead>Personne</TableHead>
                      <TableHead>État</TableHead>
                      <TableHead>
                        <span className="sr-only">Renvoyer</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                          Personne dans cette catégorie.
                        </TableCell>
                      </TableRow>
                    )}
                    {shown.map((r) => {
                      const [tone, icon, label] = DELIVERY[r.status ?? 'no_device']
                      return (
                        <TableRow key={r.userId}>
                          <TableCell>
                            <Checkbox
                              aria-label={`Sélectionner ${r.name}`}
                              checked={selected.has(r.userId)}
                              onCheckedChange={(c) => toggle(r.userId, !!c)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{r.name}</div>
                            <div className="text-xs text-muted-foreground">{roleLabel[r.role as keyof typeof roleLabel] ?? ''}</div>
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <StatusPill tone={tone} icon={icon} label={label} />
                              {r.readAt && <StatusPill tone="active" icon={Eye} label="Lu" />}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {r.status === 'failed' && failureReason(r.errorCode)}
                              {(r.status === 'no_device' || r.status === null) && 'Pas connecté à l’app, ou notifications non autorisées'}
                              {r.attempts > 1 && ` · ${r.attempts} essais`}
                              {r.lastAttemptAt && r.status !== 'pending' && ` · ${formatDateTime(r.lastAttemptAt)}`}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={resend.isPending || r.status === 'pending'}
                              onClick={() => resend.mutate([r.userId])}
                            >
                              <RotateCw aria-hidden /> Renvoyer
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </QueryState>
      </div>
      <SheetFooter>
        <Button disabled={!selected.size || resend.isPending} onClick={() => resend.mutate([...selected])}>
          {resend.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCw aria-hidden />}
          Renvoyer {selected.size ? `à ${selected.size} personne${selected.size > 1 ? 's' : ''}` : 'aux personnes sélectionnées'}
        </Button>
      </SheetFooter>
    </>
  )
}
