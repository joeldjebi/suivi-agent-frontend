import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import L from 'leaflet'
import type { Polygon as GeoPolygon } from 'geojson'
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/** Outil de dessin de polygone (Leaflet-Geoman). */
export function DrawPolygonControl({ enabled, onDrawn }: { enabled: boolean; onDrawn: (area: GeoPolygon) => void }) {
  const map = useMap()

  useEffect(() => {
    map.pm.setLang('fr')
    map.pm.setGlobalOptions({ snappable: true, allowSelfIntersection: false })
    const handleCreate = (e: { layer: L.Layer }) => {
      const layer = e.layer as L.Polygon
      onDrawn((layer.toGeoJSON() as GeoJSON.Feature<GeoPolygon>).geometry)
      // Le polygone définitif est affiché à partir des données de l'API.
      map.removeLayer(layer)
    }
    map.on('pm:create', handleCreate)
    return () => {
      map.off('pm:create', handleCreate)
    }
  }, [map, onDrawn])

  useEffect(() => {
    if (enabled) {
      map.pm.enableDraw('Polygon', { pathOptions: { color: '#2563eb' } })
    } else {
      map.pm.disableDraw()
    }
    return () => {
      map.pm.disableDraw()
    }
  }, [enabled, map])

  return null
}

/** Rend un polygone existant modifiable et renvoie le tracé à chaque changement. */
export function EditablePolygon({ area, onChange }: { area: GeoPolygon; onChange: (area: GeoPolygon) => void }) {
  const map = useMap()
  useEffect(() => {
    const layer = L.geoJSON(area, { style: { color: '#ea580c', weight: 2 } }).getLayers()[0] as L.Polygon
    layer.addTo(map)
    layer.pm.enable({ allowSelfIntersection: false })
    const emit = () => onChange((layer.toGeoJSON() as GeoJSON.Feature<GeoPolygon>).geometry)
    layer.on('pm:edit', emit)
    map.fitBounds(layer.getBounds(), { padding: [40, 40] })
    return () => {
      layer.off('pm:edit', emit)
      layer.pm.disable()
      map.removeLayer(layer)
    }
    // Le calque est créé une seule fois par édition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])
  return null
}
