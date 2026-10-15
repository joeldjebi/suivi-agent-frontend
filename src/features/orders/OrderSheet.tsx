import { ORDER_TRANSITIONS, OrderStatus, Role } from '@suivi/shared'
import { Loader2, MapPin, StickyNote } from 'lucide-react'
import { useState } from 'react'
import { QueryState } from '@/components/app/page'
import { StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { formatMoney } from '@/lib/subscription'
import { formatQuantity } from '../products/products'
import { ORDER_ACTION, ORDER_STATUS, useOrder, type OrderDetail } from './orders'

/** Pastille du statut d'une commande. */
export function OrderStatusPill({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS[status]
  return <StatusPill tone={s.tone} icon={s.icon} label={s.label} />
}

/**
 * Détail d'une commande : lignes aux prix figés à la prise, historique des statuts, et les
 * suites possibles (livrée, payée, annulée avec motif).
 */
export function OrderSheet({ id, onOpenChange }: { id: string | null; onOpenChange: (open: boolean) => void }) {
  const query = useOrder(id)
  const order = query.data
  const [cancelling, setCancelling] = useState(false)
  return (
    <>
      <Sheet open={!!id} onOpenChange={onOpenChange}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          <SheetHeader className="border-b">
            <SheetTitle className="pr-8">{order ? `Commande ${order.reference}` : 'Commande'}</SheetTitle>
            <SheetDescription>{order ? `${order.outletName} · ${formatDateTime(order.takenAt)}` : ' '}</SheetDescription>
          </SheetHeader>
          <QueryState query={query}>{order && <Detail order={order} onCancel={() => setCancelling(true)} />}</QueryState>
        </SheetContent>
      </Sheet>
      {order && <CancelDialog order={order} open={cancelling} onOpenChange={setCancelling} />}
    </>
  )
}

function Detail({ order, onCancel }: { order: OrderDetail; onCancel: () => void }) {
  const { user } = useMe()
  const advance = useApiMutation((status: OrderStatus) => api.post(`/orders/${order.id}/status`, { status }), {
    success: 'Commande mise à jour',
    invalidate: [['orders']],
  })
  // Le responsable fait avancer les commandes de son équipe ; l'agent, depuis l'app.
  const next = user.role === Role.Agent ? [] : ORDER_TRANSITIONS[order.status]
  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <OrderStatusPill status={order.status} />
        <span className="text-sm text-muted-foreground">
          {order.agentName}
          {order.priceListName && ` · tarif ${order.priceListName}`}
        </span>
      </div>
      {order.distance != null && order.distance > 100 && (
        <p className="flex items-center gap-1.5 text-xs text-status-paused">
          <MapPin className="size-3.5" aria-hidden /> Prise à {order.distance} m du point de vente (par téléphone ?).
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produit</TableHead>
            <TableHead className="text-right">Quantité</TableHead>
            <TableHead className="text-right">Montant</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.lines.map((l) => (
            <TableRow key={l.productId}>
              <TableCell className="whitespace-normal">
                <span className="block font-medium">{l.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatMoney(l.unitPrice, order.currency)} / {l.unit.toLowerCase()}
                </span>
              </TableCell>
              <TableCell className="text-right text-sm whitespace-normal">
                {formatQuantity(l.quantity, { unit: l.unit, packagings: l.packagings ?? [] })}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(l.amount, order.currency)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Total</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatMoney(order.total, order.currency)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      {order.note && (
        <p className="flex items-start gap-2 rounded-lg border p-3 text-sm">
          <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> {order.note}
        </p>
      )}
      {next.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {next
            .filter((s) => s !== OrderStatus.Cancelled)
            .map((s) => (
              <Button key={s} disabled={advance.isPending} onClick={() => advance.mutate(s)}>
                {advance.isPending && advance.variables === s && <Loader2 className="animate-spin" aria-hidden />}
                {ORDER_ACTION[s]}
              </Button>
            ))}
          {next.includes(OrderStatus.Cancelled) && (
            <Button variant="outline" onClick={onCancel}>
              {ORDER_ACTION.cancelled}
            </Button>
          )}
        </div>
      )}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Historique</h3>
        <ol className="flex flex-col gap-3 border-l pl-4">
          {order.events.map((e, i) => (
            <li key={i} className="text-sm">
              <p className="font-medium">{ORDER_STATUS[e.status].label}</p>
              {e.comment && <p className="text-muted-foreground">« {e.comment} »</p>}
              <p className="text-xs text-muted-foreground">
                {formatDateTime(e.at)}
                {e.user && ` · ${e.user}`}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function CancelDialog({ order, open, onOpenChange }: { order: OrderDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [reason, setReason] = useState('')
  const cancel = useApiMutation(() => api.post(`/orders/${order.id}/status`, { status: OrderStatus.Cancelled, comment: reason.trim() }), {
    success: 'Commande annulée',
    invalidate: [['orders']],
    onSuccess: () => {
      setReason('')
      onOpenChange(false)
    },
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler la commande {order.reference} ?</DialogTitle>
          <DialogDescription>Elle ne comptera plus dans le chiffre d’affaires. L’agent voit le motif.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="cancel-reason">Motif</FieldLabel>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. : client absent à la livraison"
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Retour
          </Button>
          <Button variant="destructive" disabled={!reason.trim() || cancel.isPending} onClick={() => cancel.mutate(undefined)}>
            {cancel.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Annuler la commande
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
