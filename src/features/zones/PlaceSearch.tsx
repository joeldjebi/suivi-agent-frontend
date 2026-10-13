import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Polygon } from 'geojson'
import { Building2, Loader2, MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SearchInput } from '@/components/app/search-input'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface Place {
  id: string
  name: string
  detail: string
  source: 'catalog' | 'osm'
  area: Polygon
  /** Une partie déjà couverte par une autre zone a été retirée */
  trimmed: boolean
  overlaps: string[]
}

/**
 * Recherche d'un lieu (commune, quartier, marché…) : son contour devient une zone en un
 * clic, sans avoir à le dessiner.
 */
export function PlaceSearch({ onPick, disabled }: { onPick: (place: Place) => void; disabled?: boolean }) {
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 400)
    return () => clearTimeout(timer)
  }, [text])

  const query = useQuery({
    queryKey: ['zones', 'places', q],
    enabled: q.length >= 2,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get<Place[]>('/zones/places', { params: { q } })).data,
  })
  const searching = q.length >= 2
  const results = searching ? (query.data ?? []) : []

  return (
    <div className="border-b px-3 py-2">
      <SearchInput
        value={text}
        onChange={setText}
        placeholder="Créer depuis un lieu : Cocody, Riviera 3…"
        label="Rechercher une commune ou un quartier pour créer une zone"
      />
      {searching && (
        <div className="mt-2" aria-live="polite">
          {query.isFetching && results.length === 0 ? (
            <p className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Recherche…
            </p>
          ) : results.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              Aucun lieu trouvé. Essayez un autre nom, ou dessinez la zone sur la carte.
            </p>
          ) : (
            <ul className={cn('flex flex-col gap-0.5', query.isFetching && 'opacity-60')}>
              {results.map((place) => {
                const Icon = place.source === 'catalog' ? Building2 : MapPin
                return (
                  <li key={place.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onPick(place)
                        setText('')
                      }}
                      className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-50"
                    >
                      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{place.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{place.detail}</span>
                        {place.trimmed && (
                          <span className="block text-xs text-status-paused">
                            Sans la partie déjà couverte par {place.overlaps.join(', ')}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
