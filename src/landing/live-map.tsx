import { DayStatus } from '@suivi/shared'
import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { MapContainer, Polygon, TileLayer, useMap } from 'react-leaflet'
import { TILE_URL } from '@/components/map/base-map'
import { agentIcon } from '@/components/map/agent-marker'
import { cn } from '@/lib/utils'
import { useReducedMotion } from './motion'

/**
 * Vraie carte d'Abidjan (OpenStreetMap) avec des zones et des agents qui se déplacent,
 * comme dans l'application. Carte figée (pas de glisser ni de zoom) : c'est une vitrine.
 */
type LatLng = [number, number]

const ZONES: { name: string; color: string; area: LatLng[] }[] = [
  {
    name: 'Plateau',
    color: '#2563eb',
    area: [
      [5.3265, -4.0255],
      [5.3305, -4.0125],
      [5.3185, -4.0085],
      [5.3135, -4.0205],
    ],
  },
  {
    name: 'Cocody',
    color: '#0d9488',
    area: [
      [5.3455, -4.0055],
      [5.3525, -3.9855],
      [5.3385, -3.9795],
      [5.3325, -3.9985],
    ],
  },
  {
    name: 'Treichville',
    color: '#d97706',
    area: [
      [5.3055, -4.0125],
      [5.3095, -3.9985],
      [5.2975, -3.9945],
      [5.2935, -4.0085],
    ],
  },
  {
    name: 'Adjamé',
    color: '#7c3aed',
    area: [
      [5.3525, -4.0305],
      [5.3585, -4.0185],
      [5.3465, -4.0125],
      [5.3425, -4.0245],
    ],
  },
]

const AGENTS: { initials: string; path: LatLng[]; speed: number; status?: DayStatus; alert?: boolean }[] = [
  {
    initials: 'KB',
    speed: 0.035,
    path: [
      [5.3245, -4.0215],
      [5.3275, -4.0165],
      [5.3225, -4.0125],
      [5.3185, -4.0175],
    ],
  },
  {
    initials: 'AD',
    speed: 0.028,
    path: [
      [5.3215, -4.0195],
      [5.3175, -4.0145],
      [5.3205, -4.0105],
      [5.3255, -4.0135],
    ],
  },
  {
    initials: 'SG',
    speed: 0.03,
    path: [
      [5.3435, -4.0005],
      [5.3475, -3.9905],
      [5.3405, -3.9865],
      [5.3375, -3.9955],
    ],
  },
  {
    initials: 'JA',
    speed: 0.025,
    path: [
      [5.3445, -3.9935],
      [5.3395, -3.9915],
      [5.3415, -3.9985],
    ],
  },
  {
    initials: 'MT',
    speed: 0.032,
    status: DayStatus.Paused,
    path: [
      [5.3035, -4.0075],
      [5.3065, -4.0025],
      [5.3005, -3.9995],
    ],
  },
  {
    initials: 'AB',
    speed: 0.04,
    alert: true,
    path: [
      [5.3335, -4.0255],
      [5.3365, -4.0345],
      [5.3305, -4.0385],
      [5.3285, -4.0295],
    ],
  },
  {
    initials: 'HK',
    speed: 0.027,
    path: [
      [5.3535, -4.0255],
      [5.3555, -4.0205],
      [5.3495, -4.0185],
    ],
  },
]

/** Position sur une boucle de points, t entre 0 et 1. */
function along(path: LatLng[], t: number): LatLng {
  const loop = [...path, path[0]]
  const segments = loop.length - 1
  const x = (t % 1) * segments
  const i = Math.floor(x)
  const f = x - i
  const [a, b] = [loop[i], loop[i + 1]]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}

function Agents() {
  const map = useMap()
  const reduced = useReducedMotion()
  useEffect(() => {
    const markers = AGENTS.map((a, i) =>
      L.marker(along(a.path, i * 0.17), {
        icon: agentIcon({ initials: a.initials, status: a.status ?? DayStatus.Active, alert: !!a.alert, selected: false }),
        interactive: false,
        keyboard: false,
      }).addTo(map),
    )
    if (reduced) return () => markers.forEach((m) => m.remove())
    // Animation seulement quand la carte est visible.
    let visible = true
    const observer = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    observer.observe(map.getContainer())
    let frame = requestAnimationFrame(function tick(now) {
      if (visible) AGENTS.forEach((a, i) => markers[i].setLatLng(along(a.path, i * 0.17 + (now / 1000) * a.speed)))
      frame = requestAnimationFrame(tick)
    })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      markers.forEach((m) => m.remove())
    }
  }, [map, reduced])
  return null
}

export function LiveMap({
  className,
  dark,
  zoom = 14,
  center = [5.3265, -4.0105],
}: {
  className?: string
  dark?: boolean
  zoom?: number
  center?: LatLng
}) {
  const ref = useRef<L.Map>(null)
  return (
    <div className={cn('landing-map relative size-full', dark && 'landing-map-dark', className)}>
      <MapContainer
        ref={ref}
        center={center}
        zoom={zoom}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        attributionControl
        className="size-full bg-[#e8eaed]"
      >
        <TileLayer url={TILE_URL} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
        {ZONES.map((z) => (
          <Polygon
            key={z.name}
            positions={z.area}
            interactive={false}
            pathOptions={{ color: z.color, weight: 2, fillOpacity: 0.12, dashArray: undefined }}
          />
        ))}
        <Agents />
      </MapContainer>
    </div>
  )
}
