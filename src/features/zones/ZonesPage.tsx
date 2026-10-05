import { Role, ZoneAccessWithoutGroups } from '@suivi/shared'
import type { Polygon as GeoPolygon } from 'geojson'
import { ArchiveRestore, CircleSlash, MapPinned, MoreHorizontal, PenLine, Plus, ShieldCheck, Trash2, UserCheck, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Polygon, Tooltip } from 'react-leaflet'
import { IMPACT_LABELS, RemoveDialog } from '@/components/app/remove-dialog'
import { SearchInput } from '@/components/app/search-input'
import { EmptyState, QueryState } from '@/components/app/page'
import { StatusPill } from '@/components/app/status'
import { BaseMap, FitZones, fitToZones } from '@/components/map/base-map'
import { LegendSection, MapTools, ZONE_LEGEND, ZoneSwatch } from '@/components/map/map-tools'
import { MapSplitLayout } from '@/components/map/split-layout'
import type L from 'leaflet'
import { toLatLngs, zoneColor } from '@/components/map/geo'
import { DrawPolygonControl, EditablePolygon } from '@/components/map/draw-control'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { useApiMutation, useZones } from '@/lib/queries'
import type { Zone } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ZoneAgentsDialog } from './ZoneAgentsDialog'
import { ZoneFormDialog } from './ZoneFormDialog'

function Occupancy({ zone }: { zone: Zone }) {
  if (zone.capacity === null) {
    return <span className="text-xs text-muted-foreground tabular-nums">{zone.taken} agent(s) · illimitée</span>
  }
  const percent = Math.round((zone.taken / zone.capacity) * 100)
  return (
    <div className="flex items-center gap-2">
      <Progress value={percent} className="h-1.5 w-20" aria-label={`${zone.taken} places prises sur ${zone.capacity}`} />
      <span className={cn('text-xs tabular-nums', zone.isFull ? 'font-medium text-status-alert' : 'text-muted-foreground')}>
        {zone.taken}/{zone.capacity}
        {zone.isFull && ' · pleine'}
      </span>
    </div>
  )
}

export function ZonesPage() {
  const { user, settings } = useMe()
  const isAdmin = user.role === Role.Admin
  const [showClosed, setShowClosed] = useState(false)
  const [nameFilter, setNameFilter] = useState('')
  const zonesQuery = useZones(showClosed)
  const zones = zonesQuery.data ?? []
  const activeZones = zones.filter((z) => z.isActive)

  const [drawing, setDrawing] = useState(false)
  const [drawnArea, setDrawnArea] = useState<GeoPolygon | undefined>()
  const [editing, setEditing] = useState<Zone | undefined>()
  const [formOpen, setFormOpen] = useState(false)
  const [reshaping, setReshaping] = useState<Zone | null>(null)
  const [reshapedArea, setReshapedArea] = useState<GeoPolygon | null>(null)
  const [removing, setRemoving] = useState<Zone | null>(null)
  const [accessZone, setAccessZone] = useState<Zone | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [map, setMap] = useState<L.Map | null>(null)

  const onDrawn = useCallback((area: GeoPolygon) => {
    setDrawing(false)
    setDrawnArea(area)
    setEditing(undefined)
    setFormOpen(true)
  }, [])

  const saveShape = useApiMutation(() => api.patch(`/zones/${reshaping!.id}`, { area: reshapedArea }), {
    success: 'Tracé enregistré',
    invalidate: [['zones']],
    onSuccess: () => {
      setReshaping(null)
      setReshapedArea(null)
    },
  })
  const reopen = useApiMutation((id: string) => api.patch(`/zones/${id}`, { isActive: true }), {
    success: 'Zone rouverte',
    invalidate: [['zones']],
  })

  const reshapeBar = reshaping && (
    <div className="absolute top-3 left-1/2 z-[400] flex -translate-x-1/2 items-center gap-2 rounded-lg border bg-card p-2 shadow-lg">
      <span className="px-1 text-sm">
        Déplacez les sommets de <strong>{reshaping.name}</strong>
      </span>
      <Button size="sm" variant="outline" onClick={() => setReshaping(null)}>
        Annuler
      </Button>
      <Button size="sm" disabled={!reshapedArea || saveShape.isPending} onClick={() => saveShape.mutate(undefined)}>
        Enregistrer le tracé
      </Button>
    </div>
  )

  // Filtre par nom : la liste seulement, la carte garde toutes les zones.
  const needle = nameFilter.trim().toLowerCase()
  const listed = needle ? zones.filter((z) => z.name.toLowerCase().includes(needle)) : zones

  const restrictionOn = !settings.useGroups && settings.zoneAccessWithoutGroups === ZoneAccessWithoutGroups.Restricted

  return (
    <>
      <MapSplitLayout
        storageKey="zones"
        title="Zones"
        subtitle={`${activeZones.length} zone(s) ouverte(s)`}
        collapsedSummary={`${activeZones.length} zone(s)`}
        actions={
          isAdmin && (
            <Button size="sm" onClick={() => setDrawing((d) => !d)} variant={drawing ? 'outline' : 'default'} disabled={!!reshaping}>
              {drawing ? <X aria-hidden /> : <Plus aria-hidden />}
              {drawing ? 'Annuler' : 'Dessiner une zone'}
            </Button>
          )
        }
        panel={
          <>
            <div className="border-b px-3 py-2">
              <SearchInput value={nameFilter} onChange={setNameFilter} placeholder="Filtrer par nom" label="Filtrer les zones par nom" />
            </div>
            {isAdmin && (
              <label className="flex items-center gap-2 border-b px-3 py-2 text-sm text-muted-foreground">
                <Switch size="sm" checked={showClosed} onCheckedChange={setShowClosed} />
                Afficher les zones fermées
              </label>
            )}
            {drawing && (
              <p role="status" className="border-b bg-primary/5 px-3 py-2 text-xs text-primary">
                Cliquez sur la carte pour placer les points du polygone, puis cliquez sur le premier point pour le fermer.
              </p>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <QueryState query={zonesQuery}>
                {zones.length > 0 && listed.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">Aucune zone ne s’appelle ainsi.</p>
                ) : zones.length === 0 ? (
                  <div className="p-3">
                    <EmptyState
                      icon={MapPinned}
                      title="Aucune zone"
                      description={isAdmin ? 'Dessinez votre première zone sur la carte.' : 'Aucune zone n’est attribuée à vos groupes.'}
                    />
                  </div>
                ) : (
                  <ul className="divide-y">
                    {listed.map((zone) => (
                      <li
                        key={zone.id}
                        onMouseEnter={() => setHighlight(zone.id)}
                        onMouseLeave={() => setHighlight(null)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5',
                          highlight === zone.id && 'bg-muted',
                          !zone.isActive && 'opacity-70',
                        )}
                      >
                        <span
                          className="size-3 shrink-0 rounded-sm"
                          style={{ background: zone.isActive ? zoneColor(zone) : '#94a3b8' }}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                            {zone.name}
                            {zone.sensitive && <StatusPill tone="paused" icon={ShieldCheck} label="Sensible" className="h-5" />}
                            {restrictionOn && zone.restricted && (
                              <StatusPill tone="info" icon={UserCheck} label="Réservée" className="h-5" />
                            )}
                            {!zone.isActive && <StatusPill tone="ended" icon={CircleSlash} label="Fermée" className="h-5" />}
                          </p>
                          {zone.isActive ? (
                            <Occupancy zone={zone} />
                          ) : (
                            <span className="text-xs text-muted-foreground">Historique conservé</span>
                          )}
                        </div>
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${zone.name}`} />}
                            >
                              <MoreHorizontal aria-hidden />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!zone.isActive && (
                                <DropdownMenuItem disabled={reopen.isPending} onClick={() => reopen.mutate(zone.id)}>
                                  <ArchiveRestore aria-hidden /> Rouvrir la zone
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(zone)
                                  setDrawnArea(undefined)
                                  setFormOpen(true)
                                }}
                              >
                                <PenLine aria-hidden /> Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setDrawing(false)
                                  setReshaping(zone)
                                  setReshapedArea(null)
                                }}
                              >
                                <MapPinned aria-hidden /> Modifier le tracé
                              </DropdownMenuItem>
                              {restrictionOn && zone.restricted && (
                                <DropdownMenuItem onClick={() => setAccessZone(zone)}>
                                  <UserCheck aria-hidden /> Agents autorisés
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setRemoving(zone)}>
                                <Trash2 aria-hidden /> {zone.isActive ? 'Fermer ou supprimer…' : 'Supprimer définitivement…'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </QueryState>
            </div>
          </>
        }
        overlay={
          <>
            <MapTools
              onFit={map ? () => fitToZones(map, activeZones) : undefined}
              legend={
                <div className="flex flex-col gap-3">
                  <LegendSection
                    title="Zones"
                    items={[...ZONE_LEGEND, { swatch: <ZoneSwatch color="#94a3b8" dashed />, label: 'Zone fermée' }]}
                  />
                </div>
              }
            />
            {reshapeBar}
          </>
        }
        map={
          <BaseMap mapRef={setMap}>
            <FitZones zones={activeZones} />
            {zones
              .filter((z) => z.id !== reshaping?.id)
              .map((zone) => (
                <Polygon
                  key={zone.id}
                  positions={toLatLngs(zone.area)}
                  pathOptions={{
                    color: zone.isActive ? zoneColor(zone) : '#94a3b8',
                    dashArray: zone.isActive ? undefined : '6 6',
                    weight: highlight === zone.id ? 3 : 2,
                    fillOpacity: highlight === zone.id ? 0.25 : zone.isActive ? 0.1 : 0.03,
                  }}
                >
                  <Tooltip sticky>{zone.name}</Tooltip>
                </Polygon>
              ))}
            {isAdmin && <DrawPolygonControl enabled={drawing} onDrawn={onDrawn} />}
            {reshaping && <EditablePolygon key={reshaping.id} area={reshaping.area} onChange={setReshapedArea} />}
          </BaseMap>
        }
      />

      <ZoneFormDialog open={formOpen} onOpenChange={setFormOpen} zone={editing} area={drawnArea} />
      <ZoneAgentsDialog zone={accessZone} onOpenChange={(o) => !o && setAccessZone(null)} />
      <RemoveDialog
        target={removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        config={
          removing && {
            noun: 'la zone',
            url: `/zones/${removing.id}`,
            deactivateLabel: 'Fermer la zone',
            deactivateEffect: 'Les agents qui l’occupent ou l’ont demandée sont prévenus et choisissent une autre zone.',
            impactLabels: IMPACT_LABELS.zone,
            invalidate: [['zones']],
          }
        }
      />
    </>
  )
}
