import L from 'leaflet'
import { useEffect, type ReactNode, type Ref } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { cn } from '@/lib/utils'
import type { Zone } from '@/lib/types'
import { DEFAULT_CENTER } from './geo'

// Tuiles publiques OSM : développement uniquement. En production, configurer
// VITE_TILE_URL (MapTiler, Stadia Maps…) — voir section 9 du cahier des charges.
export const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export function BaseMap({ children, className, mapRef }: { children?: ReactNode; className?: string; mapRef?: Ref<L.Map> }) {
  return (
    <MapContainer ref={mapRef} center={DEFAULT_CENTER} zoom={12} className={cn('h-full w-full', className)}>
      <TileLayer url={TILE_URL} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
      <AutoResize />
      {children}
    </MapContainer>
  )
}

/** Recalcule la taille de la carte quand son conteneur change (panneau replié, fenêtre). */
function AutoResize() {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    const observer = new ResizeObserver(() => map.invalidateSize({ debounceMoveend: true }))
    observer.observe(container)
    return () => observer.disconnect()
  }, [map])
  return null
}

/** Recadre la carte sur un ensemble de zones. */
export function fitToZones(map: L.Map, zones: Zone[]) {
  if (!zones.length) return
  const bounds = L.geoJSON({
    type: 'FeatureCollection',
    features: zones.map((z) => ({ type: 'Feature', properties: {}, geometry: z.area })),
  } as GeoJSON.FeatureCollection).getBounds()
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24] })
}

/** Cadre la carte sur les zones au premier affichage (puis quand la liste change). */
export function FitZones({ zones }: { zones: Zone[] }) {
  const map = useMap()
  const key = zones.map((z) => z.id).join(',')
  useEffect(() => {
    fitToZones(map, zones)
    // Recadrage seulement quand l'ensemble des zones change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}
