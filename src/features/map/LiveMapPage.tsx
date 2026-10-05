import { AlertType, DayStatus, SocketEvent } from '@suivi/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type L from 'leaflet'
import { AlertTriangle, BatteryLow, BatteryMedium, MapPinOff, Route, Search, ShieldAlert, Users, WifiOff, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Marker, Polygon, Polyline, Tooltip, useMap } from 'react-leaflet'
import { useSearchParams } from 'react-router'
import { EmptyState, QueryState } from '@/components/app/page'
import { DayStatusPill, StatusPill } from '@/components/app/status'
import { agentIcon } from '@/components/map/agent-marker'
import { BaseMap, FitZones, fitToZones } from '@/components/map/base-map'
import { toLatLngs, zoneColor } from '@/components/map/geo'
import { LegendSection, MapTools, MarkerSwatch, ZONE_LEGEND } from '@/components/map/map-tools'
import { MapSplitLayout } from '@/components/map/split-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { ALERT_META } from '@/lib/alerts'
import { useMe } from '@/lib/auth'
import { formatRelative, formatTime, fullName, initials } from '@/lib/format'
import { useGroups, useZones } from '@/lib/queries'
import { useSocketEvent } from '@/lib/socket'
import type { LiveAgent, LivePosition, TrackPoint } from '@/lib/types'
import { cn } from '@/lib/utils'

const ALL = 'all'

type StatusFilter = typeof ALL | 'active' | 'paused' | 'alert'

// « Hors zone » : la sortie suivie par le serveur, qui tient compte de la marge de la structure.
function hasAlert(a: LiveAgent) {
  return a.signalLost || !!a.zoneExit || !!a.position?.isMocked || a.alerts.length > 0
}

/** Alertes qui n'ont pas déjà leur indication (signal perdu, hors zone, position simulée). */
function extraAlerts(a: LiveAgent) {
  return a.alerts.filter((t) => t === AlertType.Immobile || t === AlertType.LowBattery)
}

/** « depuis 12 min » / « depuis 1 h 05 ». */
function since(iso: string, now = Date.now()) {
  const minutes = Math.max(1, Math.round((now - Date.parse(iso)) / 60_000))
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

function distance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1).replace('.', ',')} km` : `${Math.max(10, Math.round(meters / 10) * 10)} m`
}

/** Les alertes d'abord, puis les agents en cours, puis en pause ; ordre alphabétique ensuite. */
function rank(a: LiveAgent) {
  return hasAlert(a) ? 0 : a.status === DayStatus.Active ? 1 : 2
}

/** Centre la carte sur l'agent sélectionné. */
function FlyTo({ position }: { position: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.flyTo(position, Math.max(map.getZoom(), 15), { duration: 0.5 })
  }, [position, map])
  return null
}

const LEGEND = (
  <div className="flex flex-col gap-3">
    <LegendSection
      title="Agents"
      items={[
        { swatch: <MarkerSwatch color="#15803d" />, label: 'Journée en cours' },
        { swatch: <MarkerSwatch color="#b45309" symbol="‖" />, label: 'En pause' },
        { swatch: <MarkerSwatch color="#dc2626" symbol="!" />, label: 'Alerte : signal perdu, hors zone, immobile, batterie faible…' },
      ]}
    />
    <LegendSection title="Zones" items={ZONE_LEGEND} />
    <LegendSection
      title="Trajet"
      items={[{ swatch: <span className="w-6 border-t-[3px] border-dashed border-primary" />, label: 'Trajet de la journée' }]}
    />
  </div>
)

export function LiveMapPage() {
  const { settings } = useMe()
  const queryClient = useQueryClient()
  const zonesQuery = useZones()
  const groupsQuery = useGroups()
  const [map, setMap] = useState<L.Map | null>(null)
  const [groupId, setGroupId] = useState<string>(ALL)
  const [zoneId, setZoneId] = useState<string>(ALL)
  const [status, setStatus] = useState<StatusFilter>(ALL)
  const [search, setSearch] = useState('')
  // Ouverture depuis une alerte : /map?agent=<id>
  const [params] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get('agent'))
  const [showTrack, setShowTrack] = useState(false)
  const [, forceTick] = useState(0)

  const liveQuery = useQuery({
    queryKey: ['live'],
    queryFn: async () => (await api.get<LiveAgent[]>('/live')).data,
    // Le statut « signal perdu » dépend du temps qui passe.
    refetchInterval: 60_000,
  })

  // Rafraîchit les « il y a X min » sans requête.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const onPosition = useCallback(
    (position: LivePosition) => {
      queryClient.setQueryData<LiveAgent[]>(['live'], (agents) => {
        if (!agents) return agents
        if (!agents.some((a) => a.agent.id === position.agentId)) {
          void queryClient.invalidateQueries({ queryKey: ['live'] })
          return agents
        }
        return agents.map((a) => (a.agent.id === position.agentId ? { ...a, position, zoneId: position.zoneId, signalLost: false } : a))
      })
      if (showTrack && position.agentId === selectedId) {
        void queryClient.invalidateQueries({ queryKey: ['track'] })
      }
    },
    [queryClient, selectedId, showTrack],
  )
  const onStatus = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['live'] })
    void queryClient.invalidateQueries({ queryKey: ['zones'] })
  }, [queryClient])
  useSocketEvent(SocketEvent.AgentPosition, onPosition)
  useSocketEvent(SocketEvent.AgentStatus, onStatus)
  const onZoneExit = useCallback(() => void queryClient.invalidateQueries({ queryKey: ['live'] }), [queryClient])
  useSocketEvent(SocketEvent.AgentZoneExit, onZoneExit)

  const agents = useMemo(() => liveQuery.data ?? [], [liveQuery.data])
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return agents
      .filter(
        (a) =>
          (groupId === ALL || a.agent.groupId === groupId) &&
          (zoneId === ALL || a.zoneId === zoneId) &&
          (status === ALL ||
            (status === 'alert' ? hasAlert(a) : a.status === (status === 'active' ? DayStatus.Active : DayStatus.Paused))) &&
          (!term || fullName(a.agent).toLowerCase().includes(term)),
      )
      .sort((a, b) => rank(a) - rank(b) || fullName(a.agent).localeCompare(fullName(b.agent), 'fr'))
  }, [agents, groupId, zoneId, status, search])

  const counts = useMemo(
    () => ({
      active: agents.filter((a) => a.status === DayStatus.Active).length,
      paused: agents.filter((a) => a.status === DayStatus.Paused).length,
      alert: agents.filter(hasAlert).length,
    }),
    [agents],
  )

  const selected = agents.find((a) => a.agent.id === selectedId) ?? null
  const trackQuery = useQuery({
    queryKey: ['track', selected?.dayId],
    enabled: showTrack && !!selected,
    queryFn: async () => (await api.get<TrackPoint[]>(`/days/${selected!.dayId}/positions`)).data,
  })

  const zones = useMemo(() => zonesQuery.data ?? [], [zonesQuery.data])
  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name ?? 'Sans zone'

  const select = (id: string | null) => {
    setSelectedId(id)
    setShowTrack(false)
  }

  const panel = (
    <>
      <div className="flex flex-col gap-3 border-b p-3">
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Filtrer par statut">
          {(
            [
              ['active', 'En cours', counts.active, 'text-status-active', 'bg-status-active'],
              ['paused', 'En pause', counts.paused, 'text-status-paused', 'bg-status-paused'],
              ['alert', 'Alertes', counts.alert, 'text-status-alert', 'bg-status-alert'],
            ] as const
          ).map(([key, label, count, color, bar]) => (
            <button
              key={key}
              type="button"
              aria-pressed={status === key}
              onClick={() => setStatus(status === key ? ALL : key)}
              className={cn(
                'relative flex flex-col items-start overflow-hidden rounded-lg border bg-card px-2.5 py-2 text-left transition-colors hover:bg-muted',
                status === key && 'border-primary ring-2 ring-primary/20',
                key === 'alert' && count > 0 && 'border-status-alert/40 bg-status-alert/5',
              )}
            >
              <span className={cn('absolute inset-y-0 left-0 w-1', bar)} aria-hidden />
              <span className={cn('text-xl leading-tight font-semibold tabular-nums', color)}>{count}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            placeholder="Rechercher un agent"
            aria-label="Rechercher un agent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {settings.useGroups && (
            <Select value={groupId} onValueChange={(v) => setGroupId(v ?? ALL)}>
              <SelectTrigger className="w-full" aria-label="Filtrer par groupe">
                <SelectValue>
                  {(v: string) => (v === ALL ? 'Tous les groupes' : groupsQuery.data?.find((g) => g.id === v)?.name)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les groupes</SelectItem>
                {groupsQuery.data?.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={zoneId} onValueChange={(v) => setZoneId(v ?? ALL)}>
            <SelectTrigger className={cn('w-full', !settings.useGroups && 'col-span-2')} aria-label="Filtrer par zone">
              <SelectValue>{(v: string) => (v === ALL ? 'Toutes les zones' : zoneName(v))}</SelectValue>
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <QueryState query={liveQuery} rows={6}>
          {filtered.length === 0 ? (
            <div className="p-3">
              <EmptyState
                icon={Users}
                title={agents.length ? 'Aucun agent ne correspond aux filtres' : 'Aucun agent en journée'}
                description={agents.length ? undefined : 'Les agents apparaissent ici dès qu’ils démarrent leur journée dans l’app mobile.'}
              />
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((a) => {
                const alert = hasAlert(a)
                return (
                  <li key={a.agent.id}>
                    <button
                      type="button"
                      onClick={() => select(a.agent.id === selectedId ? null : a.agent.id)}
                      aria-current={a.agent.id === selectedId}
                      className={cn(
                        'flex w-full items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted',
                        alert && 'border-status-alert',
                        a.agent.id === selectedId && 'border-primary bg-primary/5',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                          alert ? 'bg-status-alert/10 text-status-alert' : 'bg-secondary',
                        )}
                      >
                        {initials(a.agent)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium">{fullName(a.agent)}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {zoneName(a.zoneId)} · {a.position ? formatRelative(a.position.recordedAt) : 'aucune position'}
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <DayStatusPill status={a.status} signalLost={a.signalLost} />
                        {a.zoneExit && (
                          <span className="text-xs font-medium text-status-alert">Hors zone · {since(a.zoneExit.exitedAt)}</span>
                        )}
                        {a.position?.isMocked && <span className="text-xs font-medium text-status-alert">Position simulée</span>}
                        {extraAlerts(a).map((t) => (
                          <span key={t} className="text-xs font-medium text-status-alert">
                            {ALERT_META[t].label}
                          </span>
                        ))}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </QueryState>
      </div>
    </>
  )

  const card = selected && (
    <div className="absolute right-3 bottom-3 left-3 z-[400] rounded-xl border bg-card p-4 shadow-lg sm:left-auto sm:w-80">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{fullName(selected.agent)}</p>
          <p className="text-xs text-muted-foreground">
            {zoneName(selected.zoneId)} · depuis {formatTime(selected.startedAt, settings.timezone)}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Fermer la fiche" onClick={() => select(null)}>
          <X aria-hidden />
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <DayStatusPill status={selected.status} signalLost={selected.signalLost} />
        {selected.zoneExit && <StatusPill tone="alert" icon={MapPinOff} label="Hors de sa zone" />}
        {selected.position?.isMocked && <StatusPill tone="alert" icon={ShieldAlert} label="Position simulée" />}
        {extraAlerts(selected).map((t) => (
          <StatusPill key={t} tone="alert" icon={ALERT_META[t].icon} label={ALERT_META[t].label} />
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Dernière position</dt>
          <dd>{selected.position ? formatRelative(selected.position.recordedAt) : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Batterie</dt>
          <dd className="flex items-center gap-1">
            {selected.position?.batteryLevel != null ? (
              <>
                {selected.position.batteryLevel < 0.2 ? (
                  <BatteryLow className="size-4 text-status-alert" aria-hidden />
                ) : (
                  <BatteryMedium className="size-4" aria-hidden />
                )}
                {Math.round(selected.position.batteryLevel * 100)} %
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Précision</dt>
          <dd>{selected.position ? `± ${Math.round(selected.position.accuracy)} m` : '—'}</dd>
        </div>
      </dl>
      {selected.zoneExit && (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-status-alert/10 p-2 text-xs text-status-alert">
          <MapPinOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Hors de {zoneName(selected.zoneExit.zoneId)} depuis {since(selected.zoneExit.exitedAt)} (sortie à{' '}
            {formatTime(selected.zoneExit.exitedAt, settings.timezone)}), jusqu’à {distance(selected.zoneExit.maxDistanceM)}.{' '}
            {selected.zoneExit.alertedAt
              ? `Responsable prévenu à ${formatTime(selected.zoneExit.alertedAt, settings.timezone)}.`
              : `Responsable prévenu au-delà de ${settings.zoneExitAlertMinutes} min.`}
          </span>
        </p>
      )}
      {selected.signalLost && (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-status-alert/10 p-2 text-xs text-status-alert">
          <WifiOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Aucune position depuis plus de {settings.signalLostMinutes} min : GPS coupé, application fermée ou réseau absent.
        </p>
      )}
      <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setShowTrack((v) => !v)} disabled={!selected.position}>
        <Route aria-hidden /> {showTrack ? 'Masquer le trajet' : 'Voir le trajet'}
      </Button>
      {showTrack && trackQuery.isError && (
        <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="size-3.5" aria-hidden /> Trajet indisponible
        </p>
      )}
    </div>
  )

  return (
    <MapSplitLayout
      storageKey="live-map"
      title="Carte en temps réel"
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-active opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-status-active" />
          </span>
          {agents.length} agent(s) en journée
        </span>
      }
      collapsedSummary={
        <>
          {agents.length} en journée
          {counts.alert > 0 && <span className="ml-1 font-semibold text-status-alert">· {counts.alert} alerte(s)</span>}
        </>
      }
      panel={panel}
      overlay={
        <>
          <MapTools onFit={map ? () => fitToZones(map, zones) : undefined} legend={LEGEND} />
          {card}
        </>
      }
      map={
        <BaseMap mapRef={setMap}>
          <FitZones zones={zones} />
          {zones.map((zone) => (
            <Polygon
              key={zone.id}
              positions={toLatLngs(zone.area)}
              pathOptions={{ color: zoneColor(zone), weight: 2, fillOpacity: zoneId === zone.id ? 0.2 : 0.08 }}
            >
              <Tooltip sticky>
                <strong>{zone.name}</strong>
                <br />
                {zone.capacity === null ? `${zone.taken} agent(s), illimitée` : `${zone.taken} / ${zone.capacity} places`}
              </Tooltip>
            </Polygon>
          ))}
          {filtered.map((a) =>
            a.position ? (
              <Marker
                key={a.agent.id}
                position={[a.position.lat, a.position.lng]}
                title={`${fullName(a.agent)} — ${a.signalLost ? 'signal perdu' : a.status === DayStatus.Paused ? 'en pause' : 'en cours'}`}
                icon={agentIcon({
                  initials: initials(a.agent),
                  status: a.status,
                  alert: hasAlert(a),
                  selected: a.agent.id === selectedId,
                })}
                eventHandlers={{ click: () => select(a.agent.id) }}
              />
            ) : null,
          )}
          {showTrack && trackQuery.data && trackQuery.data.length > 1 && (
            <Polyline
              positions={trackQuery.data.map((p) => [p.lat, p.lng])}
              pathOptions={{ color: '#2563eb', weight: 3, dashArray: '6 6' }}
            />
          )}
          <FlyTo position={selected?.position ? [selected.position.lat, selected.position.lng] : null} />
        </BaseMap>
      }
    />
  )
}
