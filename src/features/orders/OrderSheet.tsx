import {
  Feature,
  ORDER_TRANSITIONS,
  OrderKind,
  OrderStatus,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  Role,
  SALE_FLAG_LABELS,
  SaleFlag,
} from '@suivi/shared'
import { AlertTriangle, FileDown, Loader2, MapPin, StickyNote, Truck } from 'lucide-react'
import { useState } from 'react'
import { QueryState } from '@/components/app/page'
import { StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { formatMoney, useFeature } from '@/lib/subscription'
import { downloadReceipt, PAYMENT_METHODS } from '../van-sales/van-sales'
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
            <SheetTitle className="pr-8">
              {order ? `${order.kind === OrderKind.Sale ? 'Vente' : 'Commande'} ${order.reference}` : 'Commande'}
            </SheetTitle>
            <SheetDescription>{order ? `${order.outletName} · ${formatDateTime(order.takenAt)}` : ' '}</SheetDescription>
          </SheetHeader>
          <QueryState query={query}>{order && <Detail order={order} onCancel={() => setCancelling(true)} />}</QueryState>
        </SheetContent>
      </Sheet>
      {order &&
        (order.kind === OrderKind.Sale ? (
          <CancelSaleDialog order={order} open={cancelling} onOpenChange={setCancelling} />
        ) : (
          <CancelDialog order={order} open={cancelling} onOpenChange={setCancelling} />
        ))}
    </>
  )
}

function Detail({ order, onCancel }: { order: OrderDetail; onCancel: () => void }) {
  const { user } = useMe()
  const vanSales = useFeature(Feature.VanSales)
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.Cash)
  const [receipt, setReceipt] = useState(false)
  const advance = useApiMutation(
    (status: OrderStatus) => api.post(`/orders/${order.id}/status`, { status, ...(status === OrderStatus.Paid ? { method } : {}) }),
    { success: 'Commande mise à jour', invalidate: [['orders'], ['van-sales']] },
  )
  const isSale = order.kind === OrderKind.Sale
  // Le responsable fait avancer les commandes de son équipe ; l'agent, depuis l'app. Une vente
  // directe est déjà livrée : il reste à l'encaisser, ou à l'annuler (marchandise rendue au camion).
  const next =
    user.role === Role.Agent
      ? []
      : isSale
        ? order.status === OrderStatus.Cancelled
          ? []
          : [...(order.status === OrderStatus.Delivered ? [OrderStatus.Paid] : []), OrderStatus.Cancelled]
        : ORDER_TRANSITIONS[order.status]
  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <OrderStatusPill status={order.status} />
        <span className="text-sm text-muted-foreground">
          {order.agentName}
          {order.priceListName && ` · tarif ${order.priceListName}`}
        </span>
      </div>
      {isSale && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Truck className="size-4" aria-hidden /> Vente directe depuis {order.locationName ?? 'un camion'} : livrée sur place.
        </p>
      )}
      {order.flags.includes(SaleFlag.OutOfZone) && (
        <div className="flex items-start gap-2 rounded-lg border border-status-paused/30 bg-status-paused/5 p-3 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0 text-status-paused" aria-hidden />
          <span>
            <span className="font-medium">Vente hors zone</span> : client hors du secteur de l’agent, vendu sur place en urgence
            {order.outOfZoneReason ? ` (« ${order.outOfZoneReason} »)` : ''}.
          </span>
        </div>
      )}
      {order.flags.some((f) => f !== SaleFlag.OutOfZone) && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-status-alert/30 bg-status-alert/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-alert" aria-hidden />
          <span>
            <span className="font-medium">
              À vérifier :{' '}
              {order.flags
                .filter((f) => f !== SaleFlag.OutOfZone)
                .map((f) => SALE_FLAG_LABELS[f].toLowerCase())
                .join(', ')}
              .
            </span>{' '}
            Vente enregistrée sans réseau : le téléphone ne pouvait pas le savoir. Vérifiez avec l’agent.
          </span>
        </div>
      )}
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
          {order.paidAmount > 0 && order.paidAmount < order.total && order.status !== OrderStatus.Cancelled && (
            <>
              <TableRow>
                <TableCell colSpan={2} className="font-normal">
                  Déjà payé
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(order.paidAmount, order.currency)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2}>Reste à payer</TableCell>
                <TableCell className="text-right font-semibold text-status-paused tabular-nums">
                  {formatMoney(order.due, order.currency)}
                </TableCell>
              </TableRow>
            </>
          )}
        </TableFooter>
      </Table>
      {order.note && (
        <p className="flex items-start gap-2 rounded-lg border p-3 text-sm">
          <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /> {order.note}
        </p>
      )}
      {vanSales && (
        <Button
          variant="outline"
          className="self-start"
          disabled={receipt}
          onClick={() => {
            setReceipt(true)
            downloadReceipt(order.id, order.reference).finally(() => setReceipt(false))
          }}
        >
          {receipt ? <Loader2 className="animate-spin" aria-hidden /> : <FileDown aria-hidden />} Télécharger le reçu (PDF)
        </Button>
      )}
      {vanSales && next.includes(OrderStatus.Paid) && (
        <Field orientation="horizontal" className="items-center">
          <FieldLabel htmlFor="pay-method" className="shrink-0">
            Encaissé en
          </FieldLabel>
          <Select value={method} onValueChange={(v) => v && setMethod(v as PaymentMethod)}>
            <SelectTrigger id="pay-method" size="sm" className="w-48">
              <SelectValue>{(v: string) => PAYMENT_METHOD_LABELS[v as PaymentMethod]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
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
              {isSale ? 'Annuler la vente…' : ORDER_ACTION.cancelled}
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

/** Vente annulée : la marchandise revient dans le camion, l'argent reçu est rendu au client. */
function CancelSaleDialog({ order, open, onOpenChange }: { order: OrderDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [reason, setReason] = useState('')
  const cancel = useApiMutation(() => api.post(`/van-sales/sales/${order.id}/cancel`, { reason: reason.trim() }), {
    success: 'Vente annulée : la marchandise est revenue dans le camion',
    invalidate: [['orders'], ['stock'], ['van-sales']],
    onSuccess: () => {
      setReason('')
      onOpenChange(false)
    },
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler la vente {order.reference} ?</DialogTitle>
          <DialogDescription>
            La marchandise revient dans le stock de {order.locationName ?? 'son camion'}
            {order.paidAmount > 0 &&
              `, et les ${formatMoney(order.paidAmount, order.currency)} reçus sont rendus au client (ils sortent de la caisse de l’agent)`}
            .
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="cancel-sale-reason">Motif</FieldLabel>
          <Textarea
            id="cancel-sale-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. : vente saisie en double"
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Retour
          </Button>
          <Button variant="destructive" disabled={!reason.trim() || cancel.isPending} onClick={() => cancel.mutate(undefined)}>
            {cancel.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Annuler la vente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
