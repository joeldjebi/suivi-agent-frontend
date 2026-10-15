import { keepPreviousData, useQuery } from '@tanstack/react-query'
import L from 'leaflet'
import { AlertTriangle, ChevronRight, Clock, PackageX, ShoppingBag, Store, TrendingDown } from 'lucide-react'
import { Link } from 'react-router'
import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, Tooltip as MapTooltip, useMap } from 'react-leaflet'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Page, PageHeader, QueryState } from '@/components/app/page'
import { PeriodPicker } from '@/components/app/period-picker'
import { BaseMap } from '@/components/map/base-map'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { formatDateTime, formatNumber } from '@/lib/format'
import { usePeriod } from '@/lib/period'
import { useZones } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { OutletSheet } from '../outlets/OutletSheet'
import { Card, Kpi } from '../stats/components'
import { formatPrice, formatQuantity, productName, useProducts, type Product } from './products'

/** Nos produits / la concurrence : deux couleurs, toujours avec une légende. */
const OWN = '#2563eb'
const COMPETITOR = '#d97706'
const ALL = 'all'

interface Overview {
  visits: number
  outlets: number
  products: number
  ownStockouts: number
  ownChecked: number
  stockoutRate: number | null
  ownSold: number
  competitorSold: number
  ownLosses: number
}

interface Stockouts {
  byProduct: { productId: string; name: string; format: string | null; own: boolean; checked: number; stockouts: number; rate: number }[]
  outlets: {
    productId: string
    productName: string
    format: string | null
    own: boolean
    outletId: string
    outletName: string
    zone: string | null
    since: string
    lat: number | null
    lng: number | null
    agent: string | null
  }[]
}

interface Sales {
  products: (Pick<Product, 'name' | 'format' | 'own' | 'unit' | 'packagings'> & {
    productId: string
    category: string | null
    sold: number
    losses: number
    ordered: number
    outlets: number
  })[]
  lossOutlets: { outletId: string; outletName: string; zone: string | null; losses: number; products: number }[]
}

interface Prices {
  products: {
    productId: string
    name: string
    format: string | null
    own: boolean
    category: string | null
    unit: string
    avg: number
    min: number
    max: number
    readings: number
    zones: { zone: string; avg: number }[]
  }[]
  categories: { category: string; own: number; competitor: number; gapPercent: number }[]
}

/**
 * Tableau de bord des relevés produits : ruptures en cours (carte et liste), ventes et pertes,
 * prix face à la concurrence. Le chef ne voit que les relevés de son équipe.
 */
export function ProductInsightsPage() {
  const period = usePeriod()
  const [zoneId, setZoneId] = useState(ALL)
  const [category, setCategory] = useState(ALL)
  const [side, setSide] = useState<'all' | 'own' | 'competitor'>('all')
  const [outlet, setOutlet] = useState<string | null>(null)
  const zones = (useZones().data ?? []).filter((z) => z.isActive)
  const catalogQuery = useProducts(true)
  const catalog = catalogQuery.data ?? []
  const categories = [...new Set(catalog.map((p) => p.category).filter((c): c is string => !!c))]
  const byId = useMemo(() => new Map((catalogQuery.data ?? []).map((p) => [p.id, p])), [catalogQuery.data])
  const params = {
    from: period.from,
    to: period.to,
    zoneId: zoneId === ALL ? undefined : zoneId,
    category: category === ALL ? undefined : category,
    side: side === 'all' ? undefined : side,
  }
  const fetch = <T,>(path: string) => ({
    queryKey: ['insights', path, params],
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get<T>(`/insights/products/${path}`, { params })).data,
  })
  const overview = useQuery(fetch<Overview>('overview'))
  const stockouts = useQuery(fetch<Stockouts>('stockouts'))
  const sales = useQuery(fetch<Sales>('sales'))
  const prices = useQuery(fetch<Prices>('prices'))
  const o = overview.data

  return (
    <Page>
      <PageHeader
        title="Tableau de bord produits"
        description="Ce que vos agents relèvent dans les points de vente : ruptures, ventes, pertes et prix face à la concurrence."
      />
      <div className="flex flex-wrap items-end gap-3">
        <PeriodPicker period={period} />
        <div className="flex flex-col gap-1.5">
          <Label>Zone</Label>
          <Select value={zoneId} onValueChange={(v) => setZoneId(v ?? ALL)}>
            <SelectTrigger className="w-44" aria-label="Zone">
              <SelectValue>{(v: string) => (v === ALL ? 'Toutes les zones' : (zones.find((z) => z.id === v)?.name ?? 'Zone'))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes les zones</SelectItem>
              {zones.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {categories.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label>Catégorie</Label>
            <Select value={category} onValueChange={(v) => setCategory(v ?? ALL)}>
              <SelectTrigger className="w-44" aria-label="Catégorie">
                <SelectValue>{(v: string) => (v === ALL ? 'Toutes' : v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toutes</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Tabs value={side} onValueChange={(v) => setSide(v as typeof side)}>
          <TabsList>
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="own">Nos produits</TabsTrigger>
            <TabsTrigger value="competitor">Concurrents</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <QueryState query={overview}>
        {o && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={PackageX}
              label="Taux de rupture (nos produits)"
              value={o.stockoutRate === null ? '—' : `${o.stockoutRate} %`}
              hint={
                o.ownChecked
                  ? `${o.ownStockouts} rupture${o.ownStockouts > 1 ? 's' : ''} sur ${o.ownChecked} relevés`
                  : 'Aucun relevé de présence'
              }
              tone={o.stockoutRate !== null && o.stockoutRate >= 20 ? 'text-status-alert' : undefined}
            />
            <Kpi
              icon={Store}
              label="Points de vente relevés"
              value={formatNumber(o.outlets)}
              hint={`${formatNumber(o.visits)} visite${o.visits > 1 ? 's' : ''} avec relevé · ${o.products} produit${o.products > 1 ? 's' : ''}`}
            />
            <Kpi
              icon={ShoppingBag}
              label="Vendu (nos produits)"
              value={formatNumber(o.ownSold)}
              suffix="unités"
              hint={`Concurrence : ${formatNumber(o.competitorSold)} unités`}
            />
            <Kpi icon={TrendingDown} label="Pertes (nos produits)" value={formatNumber(o.ownLosses)} suffix="unités" />
          </div>
        )}
      </QueryState>

      <OverdueBanner zoneId={params.zoneId} />

      <Card title="Ruptures en cours" actions={<Legend />}>
        <QueryState query={stockouts}>
          {stockouts.data && (
            <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
              <div className="flex flex-col gap-3">
                <div className="h-72 overflow-hidden rounded-md border">
                  <BaseMap>
                    <StockoutMarkers rows={stockouts.data.outlets} onSelect={setOutlet} />
                  </BaseMap>
                </div>
                <div className="max-h-72 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead>Point de vente</TableHead>
                        <TableHead>Relevé le</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockouts.data.outlets.map((r) => (
                        <TableRow key={`${r.outletId}-${r.productId}`} className="cursor-pointer" onClick={() => setOutlet(r.outletId)}>
                          <TableCell>
                            <SideDot own={r.own} /> {productName({ name: r.productName, format: r.format })}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{r.outletName}</span>
                            {r.zone && <span className="text-muted-foreground"> · {r.zone}</span>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDateTime(r.since)}
                            {r.agent && ` · ${r.agent}`}
                          </TableCell>
                        </TableRow>
                      ))}
                      {stockouts.data.outlets.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                            Aucune rupture en cours sur la période.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Taux de rupture par produit</p>
                <ul className="flex flex-col gap-2.5">
                  {stockouts.data.byProduct.map((p) => (
                    <li key={p.productId} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate">
                          <SideDot own={p.own} /> {productName(p)}
                        </span>
                        <span
                          className={cn(
                            'shrink-0 tabular-nums',
                            p.rate >= 20 ? 'font-semibold text-status-alert' : 'text-muted-foreground',
                          )}
                        >
                          {p.rate} %{' '}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({p.stockouts}/{p.checked})
                          </span>
                        </span>
                      </div>
                      <Progress value={p.rate} className="h-1.5" aria-label={`Rupture de ${p.name} : ${p.rate} %`} />
                    </li>
                  ))}
                  {stockouts.data.byProduct.length === 0 && <li className="text-sm text-muted-foreground">Aucun relevé de présence.</li>}
                </ul>
              </div>
            </div>
          )}
        </QueryState>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Ventes" actions={<Legend />}>
          <QueryState query={sales}>{sales.data && <SalesChart rows={sales.data.products} byId={byId} />}</QueryState>
        </Card>
        <Card title="Pertes">
          <QueryState query={sales}>
            {sales.data && (
              <div className="flex flex-col gap-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Pertes</TableHead>
                      <TableHead className="text-right">Commandé</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.data.products
                      .filter((p) => p.losses > 0 || p.ordered > 0)
                      .sort((a, b) => b.losses - a.losses)
                      .map((p) => (
                        <TableRow key={p.productId}>
                          <TableCell>
                            <SideDot own={p.own} /> {productName(p)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{p.losses ? formatQuantity(p.losses, p) : '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">{p.ordered ? formatQuantity(p.ordered, p) : '—'}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                {sales.data.lossOutlets.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <AlertTriangle className="size-4 text-status-paused" aria-hidden /> Points de vente aux pertes les plus fortes
                    </p>
                    <ul className="flex flex-col divide-y rounded-md border text-sm">
                      {sales.data.lossOutlets.map((l) => (
                        <li key={l.outletId}>
                          <button
                            type="button"
                            onClick={() => setOutlet(l.outletId)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted"
                          >
                            <span>
                              <span className="font-medium">{l.outletName}</span>
                              {l.zone && <span className="text-muted-foreground"> · {l.zone}</span>}
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {formatNumber(l.losses)} unités · {l.products} produit{l.products > 1 ? 's' : ''}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {sales.data.products.every((p) => !p.losses && !p.ordered) && (
                  <p className="py-6 text-center text-sm text-muted-foreground">Aucune perte relevée sur la période.</p>
                )}
              </div>
            )}
          </QueryState>
        </Card>
      </div>

      <Card title="Prix face à la concurrence" actions={<Legend />}>
        <QueryState query={prices}>
          {prices.data && (
            <div className="flex flex-col gap-4">
              {prices.data.categories.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {prices.data.categories.map((c) => (
                    <div key={c.category} className="rounded-md border p-3">
                      <p className="text-sm font-medium">{c.category}</p>
                      <p className="mt-1 flex items-baseline gap-2 text-sm">
                        <SideDot own /> Nous <span className="font-semibold tabular-nums">{formatPrice(c.own)}</span>
                      </p>
                      <p className="flex items-baseline gap-2 text-sm">
                        <SideDot own={false} /> Concurrence <span className="font-semibold tabular-nums">{formatPrice(c.competitor)}</span>
                      </p>
                      <p className={cn('mt-1 text-xs font-medium', c.gapPercent > 0 ? 'text-status-paused' : 'text-status-active')}>
                        {c.gapPercent === 0
                          ? 'Même prix moyen'
                          : `Nous sommes ${Math.abs(c.gapPercent)} % ${c.gapPercent > 0 ? 'plus chers' : 'moins chers'}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Prix moyen</TableHead>
                      <TableHead className="text-right">Minimum</TableHead>
                      <TableHead className="text-right">Maximum</TableHead>
                      <TableHead>Par zone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prices.data.products.map((p) => (
                      <TableRow key={p.productId}>
                        <TableCell>
                          <SideDot own={p.own} /> {productName(p)}
                          <span className="block text-xs text-muted-foreground">
                            {p.readings} relevé{p.readings > 1 ? 's' : ''} · par {p.unit.toLowerCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatPrice(p.avg)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPrice(p.min)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPrice(p.max)}</TableCell>
                        <TableCell>
                          <span className="flex flex-wrap gap-1">
                            {p.zones.map((z) => (
                              <span key={z.zone} className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                                {z.zone} : {formatNumber(z.avg)}
                              </span>
                            ))}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {prices.data.products.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                          Aucun prix relevé sur la période.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </QueryState>
      </Card>

      <OutletSheet id={outlet} onOpenChange={(open) => !open && setOutlet(null)} onSelect={setOutlet} />
    </Page>
  )
}

function SideDot({ own }: { own: boolean }) {
  return (
    <span
      className="mr-1 inline-block size-2 rounded-full align-middle"
      style={{ background: own ? OWN : COMPETITOR }}
      aria-label={own ? 'Notre produit' : 'Concurrent'}
    />
  )
}

function Legend() {
  return (
    <span className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full" style={{ background: OWN }} aria-hidden /> Nos produits
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full" style={{ background: COMPETITOR }} aria-hidden /> Concurrents
      </span>
    </span>
  )
}

/** Meilleures ventes : barres horizontales, nos produits en bleu et la concurrence en orange. */
function SalesChart({ rows, byId }: { rows: Sales['products']; byId: Map<string, Product> }) {
  const data = rows
    .filter((r) => r.sold > 0)
    .slice(0, 12)
    .map((r) => ({ label: productName(r), sold: r.sold, own: r.own, productId: r.productId }))
  if (!data.length) return <p className="py-10 text-center text-sm text-muted-foreground">Aucune vente relevée sur la période.</p>
  return (
    <div style={{ height: Math.max(160, data.length * 34 + 24) }} role="img" aria-label="Graphique : quantités vendues par produit">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" allowDecimals={false} />
          <YAxis type="category" dataKey="label" width={140} tickLine={false} axisLine={false} fontSize={12} stroke="var(--foreground)" />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
            contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
            formatter={(value, _name, item) => [
              formatQuantity(Number(value), byId.get((item.payload as { productId: string }).productId)),
              (item.payload as { own: boolean }).own ? 'Vendu (notre produit)' : 'Vendu (concurrent)',
            ]}
          />
          <Bar dataKey="sold" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((d) => (
              <Cell key={d.productId} fill={d.own ? OWN : COMPETITOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Un point rouge par point de vente en rupture (le nombre de produits dans la bulle). */
function StockoutMarkers({ rows, onSelect }: { rows: Stockouts['outlets']; onSelect: (id: string) => void }) {
  const map = useMap()
  const outlets = useMemo(() => {
    const byOutlet = new Map<string, { id: string; name: string; lat: number; lng: number; products: string[] }>()
    for (const r of rows) {
      if (r.lat == null || r.lng == null) continue
      const o = byOutlet.get(r.outletId) ?? { id: r.outletId, name: r.outletName, lat: r.lat, lng: r.lng, products: [] }
      o.products.push(productName({ name: r.productName, format: r.format }))
      byOutlet.set(r.outletId, o)
    }
    return [...byOutlet.values()]
  }, [rows])
  const [fitted, setFitted] = useState(false)
  useEffect(() => {
    if (fitted || !outlets.length) return
    map.fitBounds(L.latLngBounds(outlets.map((o) => [o.lat, o.lng])), { padding: [32, 32], maxZoom: 15 })
    setFitted(true)
  }, [map, outlets, fitted])
  return outlets.map((o) => (
    <CircleMarker
      key={o.id}
      center={[o.lat, o.lng]}
      radius={6 + Math.min(6, o.products.length * 2)}
      pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#dc2626', fillOpacity: 0.9 }}
      eventHandlers={{ click: () => onSelect(o.id) }}
    >
      <MapTooltip direction="top">
        <strong>{o.name}</strong> · rupture : {o.products.join(', ')}
      </MapTooltip>
    </CircleMarker>
  ))
}

/** Points de vente en retard de visite : rappel avec un lien vers la liste filtrée. */
function OverdueBanner({ zoneId }: { zoneId?: string }) {
  const query = useQuery({
    queryKey: ['outlets', 'list', 'overdue-count', zoneId],
    queryFn: async () => (await api.get<{ total: number }>('/outlets', { params: { overdue: true, zoneId, limit: 1 } })).data.total,
  })
  if (!query.data) return null
  return (
    <Link
      to="/outlets?overdue=1"
      className="flex items-center gap-3 rounded-lg border border-[#ea580c]/40 bg-[#ea580c]/5 p-3 text-sm hover:bg-[#ea580c]/10"
    >
      <Clock className="size-5 shrink-0 text-[#ea580c]" aria-hidden />
      <span className="flex-1">
        <span className="font-medium">
          {query.data} point{query.data > 1 ? 's' : ''} de vente en retard de visite
        </span>
        <span className="text-muted-foreground"> : leurs relevés datent. Voir la liste et organiser les tournées.</span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  )
}
