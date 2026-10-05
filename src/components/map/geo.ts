import type { Zone } from '@/lib/types'

/** Abidjan */
export const DEFAULT_CENTER: [number, number] = [5.3364, -4.0267]

/** Couleur d'une zone selon son remplissage. */
export function zoneColor(zone: Pick<Zone, 'isFull' | 'capacity' | 'taken'>): string {
  if (zone.isFull) return '#dc2626'
  if (zone.capacity && zone.taken / zone.capacity >= 0.75) return '#b45309'
  return '#2563eb'
}

/** Polygone GeoJSON → positions Leaflet [lat, lng]. */
export function toLatLngs(area: Zone['area']): [number, number][][] {
  return area.coordinates.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number]))
}
