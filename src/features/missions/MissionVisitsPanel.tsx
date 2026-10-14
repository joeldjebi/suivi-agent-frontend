import type { OutletStatus } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import L from 'leaflet'
import { CheckCircle2, Store } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Marker, Polygon, Tooltip, useMap } from 'react-leaflet'
import { QueryState } from '@/components/app/page'
import { BaseMap } from '@/components/map/base-map'
import { toLatLngs } from '@/components/map/geo'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { useZones } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { categoryIcon, outletIcon, visitedIcon } from '../outlets/outlet-icons'
import { OutletSheet } from '../outlets/OutletSheet'
import { OUTLET_STATUS } from '../outlets/outlets'

interface MissionOutlet {
  id: string
  name: string
  category: string | null
  status: OutletStatus
  lat: number | null
  lng: number | null
  visits: number
  visited: boolean
  lastVisitAt: string | null
  lastVisitBy: string | null
}

/**
 * Mission de visites : les points de vente restant à visiter et ceux déjà visités, sur la
 * carte (verts cochés une fois visités) et en liste.
 */
export function MissionVisitsPanel({ missionId, zoneIds, free }: { missionId: string; zoneIds: string[]; free: boolean }) {
  const [tab, setTab] = useState<'todo' | 'done'>('todo')
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const zones = (useZones().data ?? []).filter((z) => zoneIds.includes(z.id))
  const query = useQuery({
    queryKey: ['missions', missionId, 'outlets'],
    queryFn: async () => (await api.get<MissionOutlet[]>(`/missions/${missionId}/outlets`)).data,
    refetchInterval: 60_000,
  })
  const all = query.data ?? []
  const done = all.filter((o) => o.visited)
  const todo = all.filter((o) => !o.visited)
  const shown = tab === 'done' ? done : todo

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4" aria-label="Points de vente de la mission">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Points de vente</h2>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'todo' | 'done')}>
          <TabsList>
            <TabsTrigger value="todo">
              {free ? 'Pas encore visités' : 'À visiter'} ({todo.length})
            </TabsTrigger>
            <TabsTrigger value="done">Visités ({done.length})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <QueryState query={query}>
        <div className="grid gap-3 lg:grid-cols-[1fr_22rem]">
          <div className="h-80 overflow-hidden rounded-md border lg:h-96">
            <BaseMap>
              {zones.map((z) => (
                <Polygon
                  key={z.id}
                  positions={toLatLngs(z.area)}
                  pathOptions={{ color: '#64748b', weight: 1, dashArray: '4 4', fillOpacity: 0.03 }}
                  interactive={false}
                />
              ))}
              <VisitMarkers outlets={all} focus={selected ?? hovered} onSelect={setSelected} />
            </BaseMap>
          </div>
          <ul className="flex max-h-96 flex-col divide-y overflow-y-auto rounded-md border">
            {shown.length === 0 ? (
              <li className="p-6 text-center text-sm text-muted-foreground">
                {tab === 'done' ? 'Aucune visite pour le moment.' : 'Tous les points de vente ont été visités.'}
              </li>
            ) : (
              shown.map((o) => {
                const Icon = o.visited ? CheckCircle2 : categoryIcon(o.category)
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(o.id)}
                      onMouseEnter={() => setHovered(o.id)}
                      onMouseLeave={() => setHovered(null)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted"
                    >
                      <span
                        className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-white')}
                        style={{ background: o.visited ? '#16a34a' : OUTLET_STATUS[o.status].color }}
                        aria-hidden
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{o.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {o.visited
                            ? `${o.visits} visite${o.visits > 1 ? 's' : ''} · ${formatDateTime(o.lastVisitAt)}${o.lastVisitBy ? ` · ${o.lastVisitBy}` : ''}`
                            : [o.category, OUTLET_STATUS[o.status].label, o.lat == null ? 'À localiser' : null].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
        {free && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Store className="size-3.5" aria-hidden /> Objectif libre : tous les points de vente des zones de la mission peuvent être
            visités.
          </p>
        )}
      </QueryState>
      <OutletSheet id={selected} onOpenChange={(open) => !open && setSelected(null)} onSelect={setSelected} />
    </section>
  )
}

function VisitMarkers({ outlets, focus, onSelect }: { outlets: MissionOutlet[]; focus: string | null; onSelect: (id: string) => void }) {
  const map = useMap()
  const located = useMemo(() => outlets.filter((o) => o.lat != null && o.lng != null), [outlets])
  const [fitted, setFitted] = useState(false)
  useEffect(() => {
    if (fitted || !located.length) return
    map.fitBounds(L.latLngBounds(located.map((o) => [o.lat!, o.lng!])), { padding: [32, 32], maxZoom: 16 })
    setFitted(true)
  }, [map, located, fitted])
  return located.map((o) => (
    <Marker
      key={o.id}
      position={[o.lat!, o.lng!]}
      icon={o.visited ? visitedIcon(o.id === focus) : outletIcon(o.category, o.status, o.id === focus)}
      zIndexOffset={o.id === focus ? 1000 : o.visited ? 0 : 500}
      title={o.name}
      eventHandlers={{ click: () => onSelect(o.id) }}
    >
      <Tooltip direction="top">
        {o.name} · {o.visited ? `visité (${o.visits})` : 'à visiter'}
      </Tooltip>
    </Marker>
  ))
}
