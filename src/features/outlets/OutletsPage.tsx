import { OutletStatus, Role } from '@suivi/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import L from 'leaflet'
import { Clock, FileUp, ListChecks, MapPin, MoreHorizontal, Plus, Store, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, Marker, Polygon, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { ExportButton } from '@/components/app/export-button'
import { EmptyState, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { SearchInput } from '@/components/app/search-input'
import { BaseMap } from '@/components/map/base-map'
import { toLatLngs } from '@/components/map/geo'
import { LegendSection, MapTools } from '@/components/map/map-tools'
import { MapSplitLayout } from '@/components/map/split-layout'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { useZones } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { OutletFieldsDialog, OutletImportDialog } from './OutletAdminDialogs'
import { OutletFormDialog } from './OutletFormDialog'
import { OutletSheet, OutletStatusPill } from './OutletSheet'
import { categoryIcon, OVERDUE_COLOR, outletIcon } from './outlet-icons'
import { visitLabel } from './outlets'
import { StatusPill } from '@/components/app/status'
import { useSearchParams } from 'react-router'
import { OUTLET_STATUS, STATUSES, type Outlet, type OutletPage, type OutletPoint } from './outlets'

const PAGE_SIZE = 50
const ALL = 'all'

/**
 * Points de vente : la carte colorée par statut et la liste filtrable. Ajout en cliquant sur
 * la carte (les agents les ajoutent sur place depuis l'app), import, export, fiche détaillée.
 */
export function OutletsPage() {
  const { user } = useMe()
  const isAdmin = user.role === Role.Admin
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<OutletStatus | null>(null)
  const [zoneId, setZoneId] = useState<string>(ALL)
  const [unlocated, setUnlocated] = useState(false)
  // Lien « points de vente en retard » (avis du matin, tableau de bord) : ?overdue=1.
  const [params] = useSearchParams()
  const [overdue, setOverdue] = useState(params.get('overdue') === '1')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  // Choix d'une position sur la carte : nouveau point de vente, ou déplacement d'une fiche.
  const [placing, setPlacing] = useState<{ outlet?: Outlet } | null>(null)
  const [form, setForm] = useState<{ outlet?: Outlet; position?: { lat: number; lng: number } } | null>(null)
  const [importing, setImporting] = useState(false)
  const [editingFields, setEditingFields] = useState(false)
  const [map, setMap] = useState<L.Map | null>(null)
  const zones = (useZones().data ?? []).filter((z) => z.isActive)

  useEffect(() => {
    const timer = setTimeout(() => setSearch(q.trim()), 300)
    return () => clearTimeout(timer)
  }, [q])
  useEffect(() => setPage(1), [search, status, zoneId, unlocated, overdue])

  const filters = {
    q: search || undefined,
    status: status ?? undefined,
    zoneId: zoneId === ALL ? undefined : zoneId,
  }
  const list = useQuery({
    queryKey: ['outlets', 'list', filters, unlocated, overdue, page],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await api.get<OutletPage>('/outlets', {
          params: { ...filters, unlocated: unlocated || undefined, overdue: overdue || undefined, page, limit: PAGE_SIZE },
        })
      ).data,
  })
  const points = useQuery({
    queryKey: ['outlets', 'map', filters.status, filters.zoneId],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<OutletPoint[]>('/outlets/map', { params: { status: filters.status, zoneId: filters.zoneId } })).data,
  })
  const counts = list.data?.counts
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0
  const items = list.data?.items ?? []

  const placeBar = placing && (
    <div className="absolute top-3 left-1/2 z-[400] flex w-[min(32rem,calc(100%-1.5rem))] -translate-x-1/2 items-center gap-2 rounded-lg border bg-card p-2 shadow-lg">
      <MapPin className="ml-1 size-4 shrink-0 text-primary" aria-hidden />
      <span className="flex-1 text-sm">
        {placing.outlet ? (
          <>
            Cliquez sur la nouvelle position de <strong>{placing.outlet.name}</strong>
          </>
        ) : (
          'Cliquez à l’endroit du point de vente'
        )}
      </span>
      <Button size="sm" variant="outline" onClick={() => setPlacing(null)}>
        Annuler
      </Button>
    </div>
  )

  return (
    <>
      <MapSplitLayout
        storageKey="outlets"
        title="Points de vente"
        subtitle={`${total.toLocaleString('fr-FR')} point${total > 1 ? 's' : ''} de vente`}
        collapsedSummary={`${total} points de vente`}
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={placing && !placing.outlet ? 'outline' : 'default'}
              onClick={() => {
                setSelected(null)
                setPlacing(placing && !placing.outlet ? null : {})
              }}
            >
              {placing && !placing.outlet ? <X aria-hidden /> : <Plus aria-hidden />}
              {placing && !placing.outlet ? 'Annuler' : 'Ajouter'}
            </Button>
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button size="icon-sm" variant="outline" aria-label="Plus d’actions" />}>
                  <MoreHorizontal aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setImporting(true)}>
                    <FileUp aria-hidden /> Importer une liste…
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEditingFields(true)}>
                    <ListChecks aria-hidden /> Champs de la fiche…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        }
        panel={
          <>
            <div className="flex flex-col gap-2 border-b px-3 py-2">
              <SearchInput value={q} onChange={setQ} placeholder="Nom, gérant, téléphone, repère" label="Rechercher un point de vente" />
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par statut">
                <FilterChip active={status === null} onClick={() => setStatus(null)} label="Tous" count={total} />
                {STATUSES.map((s) => (
                  <FilterChip
                    key={s}
                    active={status === s}
                    onClick={() => setStatus(status === s ? null : s)}
                    label={OUTLET_STATUS[s].label}
                    count={counts?.[s] ?? 0}
                    color={OUTLET_STATUS[s].color}
                  />
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <Select value={zoneId} onValueChange={(v) => v && setZoneId(v)}>
                  <SelectTrigger size="sm" className="w-full" aria-label="Zone">
                    <SelectValue>
                      {(v: string) => (v === ALL ? 'Toutes les zones' : (zones.find((z) => z.id === v)?.name ?? 'Zone'))}
                    </SelectValue>
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
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    variant={unlocated ? 'secondary' : 'ghost'}
                    aria-pressed={unlocated}
                    onClick={() => setUnlocated((u) => !u)}
                  >
                    <MapPin aria-hidden /> À localiser
                  </Button>
                  <Button
                    size="sm"
                    variant={overdue ? 'secondary' : 'ghost'}
                    aria-pressed={overdue}
                    onClick={() => setOverdue((o) => !o)}
                    style={!overdue && (list.data?.overdue ?? 0) > 0 ? { color: OVERDUE_COLOR } : undefined}
                  >
                    <Clock aria-hidden /> En retard{list.data ? ` (${list.data.overdue})` : ''}
                  </Button>
                  <ExportButton
                    path="/outlets/export"
                    params={filters}
                    size="sm"
                    description="Points de vente affichés (filtres compris)"
                  />
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <QueryState query={list}>
                {total === 0 && !search && !status && zoneId === ALL ? (
                  <div className="p-3">
                    <EmptyState
                      icon={Store}
                      title="Aucun point de vente"
                      description="Vos agents les ajoutent sur place depuis l’app. Vous pouvez aussi cliquer sur « Ajouter » puis sur la carte, ou importer une liste."
                    />
                  </div>
                ) : items.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">Aucun point de vente ne correspond.</p>
                ) : (
                  <ul className={cn('divide-y', list.isPlaceholderData && 'opacity-60')}>
                    {items.map((o) => (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(o.id)
                            if (map && o.lat != null) map.flyTo([o.lat, o.lng!], Math.max(map.getZoom(), 16), { duration: 0.6 })
                          }}
                          onMouseEnter={() => setHovered(o.id)}
                          onMouseLeave={() => setHovered(null)}
                          className={cn(
                            'flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
                            selected === o.id && 'bg-primary/5',
                          )}
                        >
                          <CategoryBadge category={o.category} status={o.status} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{o.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {[o.category, o.zone?.name ?? (o.lat == null ? 'À localiser' : 'Hors zone'), visitLabel(o)]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                          {o.overdue ? (
                            <StatusPill tone="paused" icon={Clock} label="En retard" className="h-5" />
                          ) : (
                            <OutletStatusPill status={o.status} className="h-5" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </QueryState>
            </div>
            {list.data && list.data.total > PAGE_SIZE && (
              <div className="border-t px-3 py-2">
                <Pagination
                  page={page}
                  pages={Math.ceil(list.data.total / PAGE_SIZE)}
                  total={list.data.total}
                  pageSize={PAGE_SIZE}
                  onPage={setPage}
                />
              </div>
            )}
          </>
        }
        overlay={
          <>
            <MapTools
              legend={
                <div className="flex flex-col gap-3">
                  <LegendSection
                    title="Statut (couleur)"
                    items={STATUSES.map((s) => ({
                      swatch: <span className="size-3 rounded-full" style={{ background: OUTLET_STATUS[s].color }} />,
                      label: `${OUTLET_STATUS[s].label}${s === 'inactive' ? ' (‖)' : s === 'closed' ? ' (×)' : ''}`,
                    }))}
                  />
                  <LegendSection
                    title="Repère"
                    items={[
                      {
                        swatch: (
                          <span
                            className="flex size-3.5 items-center justify-center rounded-full text-white"
                            style={{ background: OVERDUE_COLOR }}
                          >
                            <Clock className="size-2.5" aria-hidden />
                          </span>
                        ),
                        label: 'En retard de visite',
                      },
                    ]}
                  />
                  <LegendSection
                    title="Type de commerce (icône)"
                    items={LEGEND_CATEGORIES.map((c) => {
                      const Icon = categoryIcon(c)
                      return { swatch: <Icon className="size-3.5 text-muted-foreground" aria-hidden />, label: c }
                    })}
                  />
                </div>
              }
            />
            {placeBar}
          </>
        }
        map={
          <BaseMap mapRef={setMap} className={cn(placing && 'cursor-crosshair')}>
            {zones.map((z) => (
              <Polygon
                key={z.id}
                positions={toLatLngs(z.area)}
                pathOptions={{ color: '#64748b', weight: 1, dashArray: '4 4', fillOpacity: 0.03 }}
                interactive={false}
              />
            ))}
            <OutletMarkers
              points={(points.data ?? []).filter((p) => !overdue || p.overdue)}
              selected={selected}
              hovered={hovered}
              onSelect={setSelected}
              placing={!!placing}
            />
            <FitPoints points={points.data} />
            {placing && (
              <PickPosition
                onPick={(position) => {
                  setForm({ outlet: placing.outlet, position })
                  setPlacing(null)
                }}
              />
            )}
          </BaseMap>
        }
      />

      <OutletSheet
        id={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        onSelect={setSelected}
        onMove={(outlet) => {
          setSelected(null)
          setPlacing({ outlet })
        }}
      />
      <OutletFormDialog
        open={!!form}
        onOpenChange={(open) => !open && setForm(null)}
        outlet={form?.outlet}
        position={form?.position}
        onSaved={(o) => setSelected(o.id)}
      />
      {isAdmin && (
        <>
          <OutletImportDialog open={importing} onOpenChange={setImporting} />
          <OutletFieldsDialog open={editingFields} onOpenChange={setEditingFields} />
        </>
      )}
    </>
  )
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  color,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  color?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors hover:bg-muted',
        active && 'border-primary bg-primary/10 text-primary hover:bg-primary/15',
      )}
    >
      {color && <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />}
      {label}
      <span className="tabular-nums text-muted-foreground">{count.toLocaleString('fr-FR')}</span>
    </button>
  )
}

/** Points dessinés sur un canevas : des milliers restent fluides. */
/** Au-delà, une vue très dézoomée montre de simples pastilles (lisible et fluide). */
const PINS_MAX_FAR = 400
const FAR_ZOOM = 14

const LEGEND_CATEGORIES = [
  'Boutique',
  'Supérette',
  'Kiosque',
  'Pharmacie',
  'Maquis / Bar',
  'Restaurant',
  'Grossiste',
  'Station-service',
  'Étal de marché',
]

/** Icône du type de commerce sur fond de la couleur du statut (liste). */
function CategoryBadge({ category, status }: { category: string | null; status: OutletStatus }) {
  const Icon = categoryIcon(category)
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
      style={{ background: OUTLET_STATUS[status].color }}
      aria-hidden
    >
      <Icon className="size-4" />
    </span>
  )
}

/** Épingles avec l'icône du type de commerce ; pastilles sur canevas quand la vue est très large. */
function OutletMarkers({
  points,
  selected,
  hovered,
  onSelect,
  placing,
}: {
  points: OutletPoint[]
  selected: string | null
  hovered: string | null
  onSelect: (id: string) => void
  placing: boolean
}) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const renderer = useMemo(() => L.canvas({ padding: 0.5 }), [])
  const far = points.length > PINS_MAX_FAR && zoom < FAR_ZOOM
  return points.map((p) => {
    const focus = p.id === selected || p.id === hovered
    const tooltip = (
      <Tooltip direction="top">
        {p.name} · {OUTLET_STATUS[p.status].label}
        {p.category && ` · ${p.category}`}
      </Tooltip>
    )
    if (far && !focus)
      return (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lng]}
          radius={5}
          interactive={!placing}
          pathOptions={{ renderer, color: '#ffffff', weight: 1.5, fillColor: OUTLET_STATUS[p.status].color, fillOpacity: 1 }}
          eventHandlers={{ click: () => onSelect(p.id) }}
        >
          {tooltip}
        </CircleMarker>
      )
    return (
      <Marker
        key={p.id}
        position={[p.lat, p.lng]}
        icon={outletIcon(p.category, p.status, focus, p.overdue)}
        zIndexOffset={focus ? 1000 : 0}
        interactive={!placing}
        keyboard={!placing}
        title={p.name}
        alt={`${p.name}, ${OUTLET_STATUS[p.status].label}`}
        eventHandlers={{ click: () => onSelect(p.id) }}
      >
        {tooltip}
      </Marker>
    )
  })
}

/** Cadre la carte sur les points au premier chargement. */
function FitPoints({ points }: { points?: OutletPoint[] }) {
  const map = useMap()
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (done || !points?.length) return
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 16 })
    setDone(true)
  }, [map, points, done])
  return null
}

function PickPosition({ onPick }: { onPick: (position: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}
