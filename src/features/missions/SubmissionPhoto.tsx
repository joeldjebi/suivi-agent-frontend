import { useQuery } from '@tanstack/react-query'
import { ImageOff, MapPin } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, Polygon, Tooltip } from 'react-leaflet'
import { BaseMap, FitZones } from '@/components/map/base-map'
import { toLatLngs } from '@/components/map/geo'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { useZones } from '@/lib/queries'
import type { PhotoMeta, Zone } from '@/lib/types'

/** Image protégée (jeton de session) : chargée par l'API puis affichée depuis la mémoire. */
function usePhotoUrl(id: string) {
  const blob = useQuery({
    queryKey: ['photos', id],
    queryFn: async () => (await api.get<Blob>(`/photos/${id}`, { responseType: 'blob' })).data,
    staleTime: Infinity,
  })
  const url = useMemo(() => (blob.data ? URL.createObjectURL(blob.data) : null), [blob.data])
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url])
  return { url, isError: blob.isError }
}

/** Miniature d'une photo de formulaire ; au clic, l'image, sa position et son heure de prise. */
export function SubmissionPhoto({
  id,
  meta,
  label,
  agentName,
  zoneIds,
}: {
  id: string
  meta?: PhotoMeta
  label: string
  agentName: string
  zoneIds: string[]
}) {
  const [open, setOpen] = useState(false)
  const { url, isError } = usePhotoUrl(id)
  const { settings } = useMe()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block size-14 overflow-hidden rounded-md border bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`Voir la photo « ${label} » de ${agentName}`}
      >
        {isError ? (
          <ImageOff className="m-auto size-5 text-muted-foreground" aria-hidden />
        ) : url ? (
          <img src={url} alt="" className="size-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <Skeleton className="size-full" />
        )}
        {meta?.lat != null && (
          <span className="absolute right-0.5 bottom-0.5 rounded bg-black/60 p-0.5 text-white">
            <MapPin className="size-3" aria-hidden />
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              {agentName}
              {meta && ` · prise le ${formatDateTime(meta.takenAt, settings.timezone)}`}
              {meta?.accuracy != null && ` · position à ${Math.round(meta.accuracy)} m près`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="flex items-center justify-center overflow-hidden rounded-lg bg-muted">
              {url ? (
                <img src={url} alt={`${label}, photo de ${agentName}`} className="max-h-[60vh] w-full object-contain" />
              ) : (
                <Skeleton className="h-72 w-full" />
              )}
            </div>
            {meta?.lat != null && meta.lng != null ? (
              <PhotoMap lat={meta.lat} lng={meta.lng} zoneIds={zoneIds} />
            ) : (
              <p className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                <MapPin className="size-4" aria-hidden /> Position indisponible au moment de la prise.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function PhotoMap({ lat, lng, zoneIds }: { lat: number; lng: number; zoneIds: string[] }) {
  const zones = useZones()
  const shown: Zone[] = (zones.data ?? []).filter((z) => zoneIds.includes(z.id))
  // Point seul : une zone fictive minuscule autour de lui pour le cadrage.
  const point: Zone = {
    ...(shown[0] ?? ({} as Zone)),
    id: 'photo',
    area: {
      type: 'Polygon',
      coordinates: [
        [
          [lng - 0.002, lat - 0.002],
          [lng + 0.002, lat - 0.002],
          [lng + 0.002, lat + 0.002],
          [lng - 0.002, lat + 0.002],
          [lng - 0.002, lat - 0.002],
        ],
      ],
    },
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="h-72 overflow-hidden rounded-lg border md:h-full md:min-h-72">
        <BaseMap>
          {shown.map((z) => (
            <Polygon key={z.id} positions={toLatLngs(z.area)} pathOptions={{ color: '#2563eb', weight: 2, fillOpacity: 0.08 }}>
              <Tooltip>{z.name}</Tooltip>
            </Polygon>
          ))}
          <CircleMarker center={[lat, lng]} radius={8} pathOptions={{ color: '#fff', weight: 2, fillColor: '#dc2626', fillOpacity: 1 }}>
            <Tooltip>Lieu de la photo</Tooltip>
          </CircleMarker>
          <FitZones zones={[...shown, point]} />
        </BaseMap>
      </div>
      <p className="text-xs text-muted-foreground">Point rouge : lieu de la photo · en bleu : zones de la mission</p>
    </div>
  )
}
