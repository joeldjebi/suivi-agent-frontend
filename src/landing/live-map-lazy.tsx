import { lazy, Suspense, type ComponentProps } from 'react'

/** Carte animée du site vitrine (Leaflet) : chargée après le reste de la page. */
const Map = lazy(() => import('./live-map').then((m) => ({ default: m.LiveMap })))

export function LiveMap(props: ComponentProps<typeof Map>) {
  return (
    <Suspense fallback={<div className="h-full w-full bg-[#e8eef3]" aria-hidden />}>
      <Map {...props} />
    </Suspense>
  )
}
