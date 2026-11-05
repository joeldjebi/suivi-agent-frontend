import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { useApiMutation } from '@/lib/queries'
import { usePhotoUrl } from '@/lib/use-photo-url'

/** Photo de référence d'un produit : l'IA s'en sert pour le reconnaître sur les rayons. */
export function ReferencePhoto({ productId, photoId: initial }: { productId: string; photoId: string | null }) {
  const input = useRef<HTMLInputElement>(null)
  // La fiche ouverte garde le produit tel qu'il était : la photo affichée suit les changements.
  const [photoId, setPhotoId] = useState(initial)
  const upload = useApiMutation(
    (file: File) => {
      const body = new FormData()
      body.append('file', file)
      return api.put<{ referencePhotoId: string }>(`/photo-ai/products/${productId}/reference`, body)
    },
    {
      success: 'Photo de référence enregistrée',
      invalidate: [['products']],
      onSuccess: (res) => setPhotoId(res.data.referencePhotoId),
    },
  )
  const remove = useApiMutation(() => api.delete(`/photo-ai/products/${productId}/reference`), {
    success: 'Photo de référence retirée',
    invalidate: [['products']],
    onSuccess: () => setPhotoId(null),
  })
  const busy = upload.isPending || remove.isPending

  return (
    <Field>
      <FieldLabel>Photo de référence (IA photo)</FieldLabel>
      <div className="flex items-center gap-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-md border bg-muted">
          {photoId ? <Thumbnail id={photoId} /> : <ImagePlus className="m-auto mt-5 size-5 text-muted-foreground" aria-hidden />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            {upload.isPending && <Loader2 className="animate-spin" aria-hidden />}
            {photoId ? 'Changer la photo' : 'Ajouter une photo'}
          </Button>
          {photoId && (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => remove.mutate(undefined)}>
              <Trash2 aria-hidden />
              Retirer
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          aria-label="Photo de référence du produit"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) upload.mutate(file)
            e.target.value = ''
          }}
        />
      </div>
      <FieldDescription>Le produit seul, de face, bien éclairé : l’IA le reconnaît mieux sur les rayons.</FieldDescription>
    </Field>
  )
}

function Thumbnail({ id }: { id: string }) {
  const { url } = usePhotoUrl(id)
  return url ? <img src={url} alt="Photo de référence" className="size-full object-cover" /> : <Skeleton className="size-full" />
}
