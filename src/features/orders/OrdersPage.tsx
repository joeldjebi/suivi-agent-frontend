import { OrderStatus, Role } from '@suivi/shared'
import { Banknote, CircleSlash, HandCoins, ShoppingCart, Tags, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { PeriodPicker } from '@/components/app/period-picker'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMe } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { usePeriod } from '@/lib/period'
import { formatMoney } from '@/lib/subscription'
import { OrderSheet, OrderStatusPill } from './OrderSheet'
import { ORDER_STATUS, useOrders, useOrdersSummary } from './orders'

const ALL = 'all'
const PAGE_SIZE = 25

/**
 * Commandes prises par les agents chez les points de vente : chiffres de la période, puis la
 * liste à suivre (livrer, encaisser) ; le détail s'ouvre au clic.
 */
export function OrdersPage() {
  const { user } = useMe()
  const period = usePeriod()
  const [status, setStatus] = useState<OrderStatus | typeof ALL>(ALL)
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<string | null>(null)
  const range = { from: period.from, to: period.to }
  const summary = useOrdersSummary(range)
  const orders = useOrders({ ...range, status: status === ALL ? undefined : status, page, limit: PAGE_SIZE })
  const s = summary.data
  const money = (n: number) => formatMoney(n, s?.currency)

  return (
    <Page>
      <PageHeader
        title="Commandes"
        description="Les commandes prises par vos agents chez les points de vente, aux prix de leur type de client : à livrer, à encaisser."
        actions={
          user.role === Role.Admin && (
            <Button variant="outline" nativeButton={false} render={<Link to="/prices" />}>
              <Tags aria-hidden /> Types de client et prix
            </Button>
          )
        }
      />
      <PeriodPicker period={period} />
      <QueryState query={summary} rows={1}>
        {s && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={ShoppingCart} label="Commandes" value={String(s.count)} hint="Hors annulées" />
            <Kpi icon={Banknote} label="Montant" value={money(s.amount)} hint={`Dont ${money(s.byStatus.paid.amount)} encaissés`} />
            <Kpi
              icon={HandCoins}
              label="À encaisser"
              value={money(s.toCollect)}
              hint={`${s.byStatus.delivered.count} livrée(s) non payée(s)`}
            />
            <Kpi
              icon={CircleSlash}
              label="Annulées"
              value={String(s.byStatus.cancelled.count)}
              hint={s.byStatus.cancelled.count ? money(s.byStatus.cancelled.amount) : undefined}
            />
          </div>
        )}
      </QueryState>
      <Tabs
        value={status}
        onValueChange={(v) => {
          setStatus(v as OrderStatus | typeof ALL)
          setPage(1)
        }}
      >
        <TabsList>
          <TabsTrigger value={ALL}>Toutes</TabsTrigger>
          {Object.values(OrderStatus).map((st) => (
            <TabsTrigger key={st} value={st}>
              {ORDER_STATUS[st].label}
              {s ? ` (${s.byStatus[st].count})` : ''}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <QueryState query={orders}>
        {!orders.data?.items.length ? (
          <EmptyState
            icon={ShoppingCart}
            title="Aucune commande"
            description="Les commandes prises par les agents depuis l’app (fiche d’un point de vente → « Prendre une commande ») apparaissent ici."
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Commande</TableHead>
                    <TableHead>Point de vente</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.data.items.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => setOpen(o.id)}>
                      <TableCell>
                        <button type="button" className="font-medium hover:underline" onClick={() => setOpen(o.id)}>
                          {o.reference}
                        </button>
                        <span className="block text-xs text-muted-foreground">{formatDateTime(o.takenAt)}</span>
                      </TableCell>
                      <TableCell>
                        {o.outletName}
                        {o.priceListName && <span className="block text-xs text-muted-foreground">{o.priceListName}</span>}
                      </TableCell>
                      <TableCell>{o.agentName}</TableCell>
                      <TableCell>
                        <OrderStatusPill status={o.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(o.total, o.currency)}
                        <span className="block text-xs text-muted-foreground">
                          {o.lines} produit{o.lines > 1 ? 's' : ''}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              page={page}
              pages={Math.ceil(orders.data.total / PAGE_SIZE)}
              total={orders.data.total}
              pageSize={PAGE_SIZE}
              onPage={setPage}
            />
          </div>
        )}
      </QueryState>
      <OrderSheet id={open} onOpenChange={(o) => !o && setOpen(null)} />
    </Page>
  )
}

function Kpi({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden /> {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
