import { Role, type TransferLegStatus, type TransferStatus } from '@suivi/shared'
import { CheckCircle2, CircleDashed, Clock, Handshake, Search, ShieldQuestion, Users, XCircle } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDateTime, formatTime } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { Card, Kpi } from '../stats/components'
import { type Transfer, useTransfers } from './van-sales'

type Tone = 'active' | 'paused' | 'alert' | 'ended' | 'info'

const STATUS_TONE: Record<TransferStatus, Tone> = {
  open: 'paused',
  covered: 'info',
  done: 'active',
  closed: 'ended',
  expired: 'ended',
}

const LEG_TONE: Record<TransferLegStatus, Tone> = {
  approval: 'alert',
  accepted: 'info',
  done: 'active',
  released: 'ended',
  rejected: 'ended',
}

const LEG_ICON = {
  approval: ShieldQuestion,
  accepted: Clock,
  done: CheckCircle2,
  released: CircleDashed,
  rejected: XCircle,
} as const

/**
 * Dépannages entre camions : demandes des agents en rupture, parts prises par leurs
 * collègues, remises. Le chef valide les parts proposées par ses agents à une autre équipe.
 */
export function TransfersPage() {
  const [state, setState] = useState<'open' | 'all'>('open')
  const transfers = useTransfers(state)
  const month = useTransfers('all')
  const { user } = useMe()
  const [rejecting, setRejecting] = useState<{ legId: string; giverName: string } | null>(null)
  const list = transfers.data ?? []
  const all = month.data ?? []
  const toApprove = all.flatMap((t) => t.legs.filter((l) => l.status === 'approval').map((l) => ({ t, l })))
  const doneCount = all.filter((t) => t.status === 'done').length
  // Agents dépannés le plus souvent (30 jours) : leur chargement du matin est à revoir.
  const frequent = Object.values(
    all.reduce<Record<string, { name: string; count: number }>>((acc, t) => {
      acc[t.requesterId] = { name: t.requesterName, count: (acc[t.requesterId]?.count ?? 0) + 1 }
      return acc
    }, {}),
  )
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const approve = useApiMutation((legId: string) => api.post(`/van-sales/transfers/legs/${legId}/approve`, {}), {
    success: 'Dépannage validé : le collègue est prévenu',
    invalidate: [['stock', 'transfers']],
  })

  return (
    <Page>
      <PageHeader
        title="Dépannages"
        description="Un agent en rupture demande des produits ; ses collègues proches prennent chacun une part et la remettent sur place, en scannant son code."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Search} label="En recherche" value={String(all.filter((t) => t.status === 'open').length)} />
        <Kpi icon={Clock} label="Tout réservé, en route" value={String(all.filter((t) => t.status === 'covered').length)} />
        <Kpi
          icon={ShieldQuestion}
          label="Parts à valider"
          value={String(toApprove.length)}
          tone={toApprove.length ? 'text-status-alert' : undefined}
        />
        <Kpi icon={CheckCircle2} label="Terminés (30 jours)" value={String(doneCount)} />
      </div>

      {toApprove.length > 0 && user.role !== Role.Agent && (
        <Card title="Parts à valider (collègue d’une autre équipe)">
          <ul className="flex flex-col divide-y">
            {toApprove.map(({ t, l }) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{l.giverName}</span> propose de dépanner{' '}
                  <span className="font-medium">{t.requesterName}</span> : {l.lines.map((x) => `${x.quantity} × ${x.name}`).join(', ')}
                </span>
                <span className="flex gap-2">
                  <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(l.id)}>
                    Valider
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRejecting({ legId: l.id, giverName: l.giverName })}>
                    Refuser
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={state} onValueChange={(v) => setState(v as 'open' | 'all')}>
          <TabsList>
            <TabsTrigger value="open">En cours</TabsTrigger>
            <TabsTrigger value="all">30 derniers jours</TabsTrigger>
          </TabsList>
        </Tabs>
        {frequent.length > 0 && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-4" aria-hidden />
            Les plus dépannés : {frequent.map((f) => `${f.name} (${f.count})`).join(', ')}
          </p>
        )}
      </div>

      <QueryState query={transfers}>
        {list.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title={state === 'open' ? 'Aucun dépannage en cours' : 'Aucun dépannage ces 30 derniers jours'}
            description="Depuis l’app, un agent en rupture liste ce qu’il lui faut : ses collègues proches qui ont ces produits sont prévenus."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {list.map((t) => (
              <TransferCard
                key={t.id}
                t={t}
                canDecide={user.role !== Role.Agent}
                onApprove={(id) => approve.mutate(id)}
                onReject={setRejecting}
              />
            ))}
          </div>
        )}
      </QueryState>
      <RejectDialog leg={rejecting} onClose={() => setRejecting(null)} />
    </Page>
  )
}

function TransferCard({
  t,
  canDecide,
  onApprove,
  onReject,
}: {
  t: Transfer
  canDecide: boolean
  onApprove: (legId: string) => void
  onReject: (leg: { legId: string; giverName: string }) => void
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="font-semibold">{t.requesterName}</h2>
          <p className="text-xs text-muted-foreground">
            Demandé le {formatDateTime(t.createdAt)}
            {t.widenedAt && ' · élargi aux autres équipes'}
            {t.note && ` · « ${t.note} »`}
          </p>
        </div>
        <StatusPill tone={STATUS_TONE[t.status]} icon={t.status === 'done' ? CheckCircle2 : Handshake} label={t.statusLabel} />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Demandé</TableHead>
              <TableHead className="text-right">Réservé</TableHead>
              <TableHead className="text-right">Remis</TableHead>
              <TableHead className="text-right">Reste</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {t.lines.map((l) => (
              <TableRow key={l.productId}>
                <TableCell>{l.name}</TableCell>
                <TableCell className="text-right tabular-nums">{l.requested}</TableCell>
                <TableCell className="text-right tabular-nums">{l.reserved || '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{l.given || '—'}</TableCell>
                <TableCell
                  className={`text-right tabular-nums ${l.remaining ? 'font-medium text-status-paused' : 'text-muted-foreground'}`}
                >
                  {l.remaining || '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-2 border-t px-4 py-3 text-sm">
        {t.legs.length === 0 ? (
          <p className="text-muted-foreground">Aucun collègue n’a encore pris de part.</p>
        ) : (
          t.legs.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <StatusPill tone={LEG_TONE[l.status]} icon={LEG_ICON[l.status]} label={l.statusLabel} className="h-5" />
                <span className="font-medium">{l.giverName}</span>
                {l.crossTeam && <span className="text-xs text-muted-foreground">(autre équipe)</span>}
                <span className="text-muted-foreground">
                  {l.status === 'done'
                    ? `a remis ${l.given.map((g) => `${g.quantity} × ${l.lines.find((x) => x.productId === g.productId)?.name ?? ''}`).join(', ')}`
                    : l.lines.map((x) => `${x.quantity} × ${x.name}`).join(', ')}
                  {l.status === 'accepted' && l.expiresAt && ` · réservé jusqu’à ${formatTime(l.expiresAt)}`}
                  {l.releaseReason && ` · ${l.releaseReason}`}
                  {l.status === 'rejected' && l.decisionNote && ` · ${l.decisionNote}`}
                </span>
              </span>
              {canDecide && l.status === 'approval' && (
                <span className="flex gap-2">
                  <Button size="sm" onClick={() => onApprove(l.id)}>
                    Valider
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onReject({ legId: l.id, giverName: l.giverName })}>
                    Refuser
                  </Button>
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function RejectDialog({ leg, onClose }: { leg: { legId: string; giverName: string } | null; onClose: () => void }) {
  const [note, setNote] = useState('')
  const reject = useApiMutation(() => api.post(`/van-sales/transfers/legs/${leg!.legId}/reject`, { note: note.trim() || undefined }), {
    success: 'Part refusée : la demande reste ouverte aux autres collègues',
    invalidate: [['stock', 'transfers']],
    onSuccess: () => {
      setNote('')
      onClose()
    },
  })
  return (
    <Dialog open={!!leg} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refuser la part de {leg?.giverName} ?</DialogTitle>
          <DialogDescription>Le collègue et le demandeur sont prévenus ; la demande reste ouverte aux autres collègues.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="transfer-reject-note">Motif (facultatif)</FieldLabel>
          <Input
            id="transfer-reject-note"
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex. : il a sa tournée à finir"
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="destructive" disabled={reject.isPending} onClick={() => reject.mutate(undefined)}>
            Refuser
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
