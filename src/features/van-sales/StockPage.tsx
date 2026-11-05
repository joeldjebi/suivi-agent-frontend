import { Role } from '@suivi/shared'
import { ArrowDownToLine, ClipboardCheck, PackageMinus, Truck, Warehouse } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMe } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { formatQuantity, packBreakdown, plural } from '../products/products'
import { CancelMovementDialog, ConfirmMovementDialog, StockActionDialog, type StockAction } from './StockDialogs'
import { LocationIcon, MovementLines, movementRoute } from './stock-ui'
import { useLocations, useMovements, useStockLevels, type StockMovement } from './van-sales'

/**
 * Stock de la vente en camionnette : ce qu'il y a dans chaque dépôt et chaque camion, les
 * chargements et retours qui attendent une confirmation, et les actions du responsable.
 */
export function StockPage() {
  const { user } = useMe()
  const levels = useStockLevels()
  const locations = useLocations()
  const pending = useMovements({ status: 'pending', limit: 50 })
  const [action, setAction] = useState<StockAction | null>(null)
  const [confirming, setConfirming] = useState<StockMovement | null>(null)
  const [cancelling, setCancelling] = useState<StockMovement | null>(null)
  const all = locations.data ?? []
  const active = (levels.data?.locations ?? []).filter((l) => l.isActive)
  const columns = [...active.filter((l) => l.kind === 'depot'), ...active.filter((l) => l.kind === 'van')]
  const products = (levels.data?.products ?? []).filter((p) => columns.some((c) => (p.quantities[c.id] ?? 0) !== 0) || p.total !== 0)

  return (
    <Page>
      <PageHeader
        title="Stock"
        description="Ce qu’il y a dans chaque dépôt et chaque camion, en temps réel : chaque vente, chargement ou casse le met à jour."
        actions={
          columns.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setAction('load')}>
                <Truck aria-hidden /> Charger un camion
              </Button>
              <Button variant="outline" onClick={() => setAction('receipt')}>
                <ArrowDownToLine aria-hidden /> Entrée au dépôt
              </Button>
              <Button variant="outline" onClick={() => setAction('inventory')}>
                <ClipboardCheck aria-hidden /> Inventaire
              </Button>
              <Button variant="outline" onClick={() => setAction('loss')}>
                <PackageMinus aria-hidden /> Casse ou perte
              </Button>
            </div>
          )
        }
      />

      {!!pending.data?.items.length && (
        <section className="flex flex-col gap-2 rounded-lg border border-status-paused/30 bg-status-paused/5 p-4" aria-label="À confirmer">
          <h2 className="font-semibold">À confirmer ({pending.data.items.length})</h2>
          <ul className="flex flex-col divide-y">
            {pending.data.items.map((m) => (
              <li key={m.id} className="flex flex-wrap items-start gap-3 py-3 first:pt-1 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {m.label} · {movementRoute(m)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(m.occurredAt)}
                    {m.createdByName && ` · par ${m.createdByName}`}
                    {m.kind === 'load' && ' · en attente de l’agent'}
                  </p>
                  <div className="mt-1">
                    <MovementLines movement={m} />
                  </div>
                </div>
                <div className="flex gap-2">
                  {m.kind === 'unload' && (
                    <Button size="sm" onClick={() => setConfirming(m)}>
                      Confirmer la réception
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setCancelling(m)}>
                    Annuler
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <QueryState query={levels}>
        {columns.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title="Aucun dépôt ni camion"
            description="Créez au moins un dépôt et un camion, et affectez chaque camion à son agent vendeur."
            action={
              user.role === Role.Admin && (
                <Button nativeButton={false} render={<Link to="/stock/locations" />}>
                  Créer les dépôts et camions
                </Button>
              )
            }
          />
        ) : products.length === 0 ? (
          <EmptyState
            icon={ArrowDownToLine}
            title="Le stock est vide"
            description="Enregistrez la marchandise reçue au dépôt, puis chargez les camions."
            action={<Button onClick={() => setAction('receipt')}>Entrée au dépôt</Button>}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-48">Produit</TableHead>
                  {columns.map((c) => (
                    <TableHead key={c.id} className="text-right">
                      <span className="inline-flex items-center gap-1.5">
                        <LocationIcon kind={c.kind} /> {c.name}
                      </span>
                      {c.kind === 'van' && (
                        <span className="block text-xs font-normal text-muted-foreground">{c.agentName ?? 'Sans agent'}</span>
                      )}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-normal">
                      <span className="font-medium">{p.name}</span> <span className="text-muted-foreground">{p.format}</span>
                    </TableCell>
                    {columns.map((c) => (
                      <Quantity key={c.id} units={p.quantities[c.id] ?? 0} product={p} />
                    ))}
                    <Quantity units={p.total} product={p} strong />
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={columns.length + 2} className="text-xs font-normal text-muted-foreground">
                    Quantités en {products[0]?.unit.toLowerCase() ?? 'unités'}s ; entre parenthèses, en conditionnements. En rouge : stock
                    négatif (vente enregistrée sans réseau), à vérifier.
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </QueryState>

      {action && <StockActionDialog action={action} onClose={() => setAction(null)} locations={all} />}
      {confirming && <ConfirmMovementDialog movement={confirming} onClose={() => setConfirming(null)} />}
      {cancelling && <CancelMovementDialog movement={cancelling} onClose={() => setCancelling(null)} />}
    </Page>
  )
}

function Quantity({
  units,
  product,
  strong,
}: {
  units: number
  product: { unit: string; packagings: { name: string; units: number }[] }
  strong?: boolean
}) {
  const { packs, rest } = packBreakdown(units, product.packagings)
  return (
    <TableCell className={`text-right tabular-nums ${units < 0 ? 'text-status-alert' : ''} ${strong ? 'font-semibold' : ''}`}>
      <span title={formatQuantity(units, product)}>{units === 0 ? '—' : units.toLocaleString('fr-FR')}</span>
      {packs.length > 0 && (
        <span className="block text-xs font-normal text-muted-foreground">
          {[...packs.map((p) => `${p.count} ${plural(p.name, p.count)}`), ...(rest ? [String(rest)] : [])].join(' + ')}
        </span>
      )}
    </TableCell>
  )
}
