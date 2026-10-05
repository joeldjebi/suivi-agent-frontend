import { ApprovalMode, ZoneRequestStatus } from '@suivi/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowRightLeft, Check, ClipboardCheck, Clock, Loader2, Repeat, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Page, PageHeader, EmptyState, QueryState } from '@/components/app/page'
import { RequestStatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDateTime, formatRelative, fullName } from '@/lib/format'
import { approvalModeLabel, releaseReasonLabel } from '@/lib/labels'
import { useApiMutation, usePendingRequests } from '@/lib/queries'
import type { Page as PageOf, ZoneRequest } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ReassignDialog } from './ReassignDialog'

function Expiry({ expiresAt }: { expiresAt: string | null }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  if (!expiresAt) return <span>—</span>
  const remaining = new Date(expiresAt).getTime() - now
  return (
    <span className={cn('inline-flex items-center gap-1 tabular-nums', remaining < 5 * 60_000 && 'font-medium text-status-alert')}>
      <Clock className="size-3.5" aria-hidden />
      {remaining > 0 ? `expire ${formatRelative(expiresAt, now)}` : 'en cours d’expiration'}
    </span>
  )
}

export function ApprovalsPage() {
  const { settings } = useMe()
  const [tab, setTab] = useState<'pending' | 'history'>('pending')
  const [page, setPage] = useState(1)
  const [rejecting, setRejecting] = useState<ZoneRequest | null>(null)
  const [reason, setReason] = useState('')
  const [reassignOpen, setReassignOpen] = useState(false)
  const pending = usePendingRequests()

  const query = useQuery({
    queryKey: ['zone-requests', tab, page],
    queryFn: async () =>
      (
        await api.get<PageOf<ZoneRequest>>('/zone-requests', {
          params: { status: tab === 'pending' ? ZoneRequestStatus.Pending : undefined, page, limit: 25 },
        })
      ).data,
    placeholderData: keepPreviousData,
    refetchInterval: tab === 'pending' ? 30_000 : false,
  })

  const decide = useApiMutation(
    ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      api.post(`/zone-requests/${id}/decision`, { approve, reason: reason || undefined }),
    {
      invalidate: [['zone-requests'], ['zones'], ['live']],
      onSuccess: () => {
        setRejecting(null)
        setReason('')
      },
    },
  )

  const items = query.data?.items ?? []
  const pages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.limit)) : 1

  return (
    <Page>
      <PageHeader
        title="Demandes de zone"
        description={`Mode d'approbation : ${approvalModeLabel[settings.approvalMode]}${
          settings.approvalMode !== ApprovalMode.Automatic ? ` · expiration après ${settings.requestExpirationMinutes} min` : ''
        }`}
        actions={
          <Button variant="outline" onClick={() => setReassignOpen(true)}>
            <ArrowRightLeft aria-hidden /> Réaffecter un agent
          </Button>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as typeof tab)
          setPage(1)
        }}
      >
        <TabsList>
          <TabsTrigger value="pending">
            En attente
            {pending > 0 && (
              <span className="ml-1.5 rounded-full bg-status-paused px-1.5 text-[11px] leading-5 font-semibold text-white tabular-nums">
                {pending}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>
      </Tabs>

      <QueryState query={query}>
        {items.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title={tab === 'pending' ? 'Aucune demande en attente' : 'Aucune demande'}
            description={
              tab === 'pending' && settings.approvalMode === ApprovalMode.Automatic
                ? 'En mode automatique, les choix de zone sont approuvés sans intervention.'
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Zone demandée</TableHead>
                  <TableHead>Demandée</TableHead>
                  <TableHead>{tab === 'pending' ? 'Délai' : 'Statut'}</TableHead>
                  {tab === 'pending' && <TableHead className="text-right">Décision</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{fullName(r.agent)}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        {r.zone.name}
                        {r.isChange && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                            <Repeat className="size-3" aria-hidden /> changement
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(r.createdAt, settings.timezone)}</TableCell>
                    <TableCell>
                      {tab === 'pending' ? (
                        <Expiry expiresAt={r.expiresAt} />
                      ) : (
                        <span className="flex flex-col gap-0.5">
                          <RequestStatusPill status={r.status} />
                          {r.releaseReason && (
                            <span className="text-xs text-muted-foreground">{releaseReasonLabel[r.releaseReason] ?? r.releaseReason}</span>
                          )}
                          {r.decisionReason && r.status === ZoneRequestStatus.Rejected && (
                            <span className="text-xs text-muted-foreground">« {r.decisionReason} »</span>
                          )}
                        </span>
                      )}
                    </TableCell>
                    {tab === 'pending' && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => setRejecting(r)} disabled={decide.isPending}>
                            <X aria-hidden /> Refuser
                          </Button>
                          <Button size="sm" onClick={() => decide.mutate({ id: r.id, approve: true })} disabled={decide.isPending}>
                            <Check aria-hidden /> Approuver
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Précédent
            </Button>
            <span className="tabular-nums text-muted-foreground">
              Page {page} / {pages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Suivant
            </Button>
          </div>
        )}
      </QueryState>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Refuser la demande</DialogTitle>
            <DialogDescription>
              {rejecting &&
                `${fullName(rejecting.agent)} sera notifié et devra choisir une autre zone. La place est libérée immédiatement.`}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="reject-reason">Motif (facultatif)</FieldLabel>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="Ex. : zone déjà couverte aujourd’hui"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={decide.isPending}
              onClick={() => rejecting && decide.mutate({ id: rejecting.id, approve: false, reason })}
            >
              {decide.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Refuser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReassignDialog open={reassignOpen} onOpenChange={setReassignOpen} />
    </Page>
  )
}
