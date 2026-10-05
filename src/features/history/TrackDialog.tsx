import { ZoneExitEndReason, type ZoneExitInfo } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import L from 'leaflet'
import { MapPinOff } from 'lucide-react'
import { useEffect } from 'react'
import { CircleMarker, Polygon, Polyline, Tooltip, useMap } from 'react-leaflet'
import { QueryState } from '@/components/app/page'
import { BaseMap } from '@/components/map/base-map'
import { toLatLngs } from '@/components/map/geo'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDate, formatTime, fullName } from '@/lib/format'
import { useZones } from '@/lib/queries'
import type { TrackPoint, WorkDay } from '@/lib/types'

function FitTrack({ points }: { points: TrackPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 16 })
  }, [points, map])
  return null
}

function minutes(e: ZoneExitInfo) {
  const end = e.endedAt ? Date.parse(e.endedAt) : Date.now()
  return Math.max(1, Math.round((end - Date.parse(e.exitedAt)) / 60_000))
}

export function TrackDialog({ day, onClose }: { day: WorkDay | null; onClose: () => void }) {
  const { settings } = useMe()
  const zones = useZones(true)
  const track = useQuery({
    queryKey: ['track', day?.id],
    enabled: !!day,
    queryFn: async () => (await api.get<TrackPoint[]>(`/days/${day!.id}/positions`)).data,
  })
  const points = track.data ?? []
  const zone = zones.data?.find((z) => z.id === day?.zoneId)
  const exits = useQuery({
    queryKey: ['zone-exits', day?.id],
    enabled: !!day,
    queryFn: async () => (await api.get<ZoneExitInfo[]>(`/days/${day!.id}/zone-exits`)).data,
  })
  const exitList = exits.data ?? []

  return (
    <Dialog open={!!day} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Trajet — {fullName(day?.agent)}</DialogTitle>
          <DialogDescription>
            {day && `${formatDate(day.workDate)} · ${points.length} position(s)`}
            {exitList.length > 0 && ` · ${exitList.length} sortie(s) de zone`}
          </DialogDescription>
        </DialogHeader>
        <QueryState query={track} rows={1}>
          {points.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucune position enregistrée pour cette journée.</p>
          ) : (
            <div className="h-[60vh] overflow-hidden rounded-lg border">
              <BaseMap>
                {zone && <Polygon positions={toLatLngs(zone.area)} pathOptions={{ color: '#2563eb', weight: 2, fillOpacity: 0.08 }} />}
                <Polyline positions={points.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#2563eb', weight: 3 }} />
                {points.map((p, i) =>
                  i === 0 || i === points.length - 1 || p.outsideZone || p.isMocked ? (
                    <CircleMarker
                      key={p.recordedAt}
                      center={[p.lat, p.lng]}
                      radius={i === 0 || i === points.length - 1 ? 7 : 5}
                      pathOptions={{
                        color: '#fff',
                        weight: 2,
                        fillOpacity: 1,
                        fillColor: p.isMocked || p.outsideZone ? '#dc2626' : i === 0 ? '#15803d' : '#1e293b',
                      }}
                    >
                      <Tooltip>
                        {i === 0 ? 'Départ' : i === points.length - 1 ? 'Dernière position' : p.isMocked ? 'Position simulée' : 'Hors zone'}{' '}
                        · {formatTime(p.recordedAt, settings.timezone)}
                      </Tooltip>
                    </CircleMarker>
                  ) : null,
                )}
                <FitTrack points={points} />
              </BaseMap>
            </div>
          )}
        </QueryState>
        {exitList.length > 0 && (
          <section aria-label="Sorties de zone" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Sorties de zone</h3>
            <ul className="divide-y rounded-lg border text-sm">
              {exitList.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <MapPinOff className="size-4 shrink-0 text-status-alert" aria-hidden />
                  <span className="font-medium tabular-nums">
                    {formatTime(e.exitedAt, settings.timezone)} → {e.endedAt ? formatTime(e.endedAt, settings.timezone) : 'en cours'}
                  </span>
                  <span className="text-muted-foreground">
                    {minutes(e)} min · jusqu’à {Math.max(10, Math.round(e.maxDistanceM / 10) * 10)} m
                    {e.endReason === ZoneExitEndReason.DayEnded && ' · fin de journée'}
                    {e.endReason === ZoneExitEndReason.ZoneChanged && ' · changement de zone'}
                  </span>
                  {e.alertedAt && <span className="ml-auto text-xs font-medium text-status-alert">Responsable prévenu</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </DialogContent>
    </Dialog>
  )
}
