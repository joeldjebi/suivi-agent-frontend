import { Gift, Loader2 } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useApiMutation } from '@/lib/queries'
import { platformApi } from '../api'
import type { PhotoAiUsageInfo } from '../types'

/** IA photo d'une structure : photos analysées ce mois-ci, et photos offertes en plus du quota. */
export function PhotoAiBonus({ tenantId, usage: u }: { tenantId: string; usage: PhotoAiUsageInfo }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [photos, setPhotos] = useState('')
  const [note, setNote] = useState('')
  const value = Number(photos)
  const valid = photos.trim() !== '' && Number.isInteger(value) && value >= 0 && value <= 1_000_000
  const save = useApiMutation(
    () => platformApi.put(`/tenants/${tenantId}/photo-ai-bonus`, { photos: value, note: note.trim() || undefined }),
    {
      success: value ? `${value} photos offertes pour ce mois-ci` : 'Supplément retiré',
      invalidate: [['platform', 'tenant', tenantId]],
      onSuccess: () => setOpen(false),
    },
  )
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm">
      <span>
        IA photo ({u.month}) :{' '}
        <span className="font-medium tabular-nums">
          {u.used} / {u.quota + u.bonus}
        </span>{' '}
        <span className="text-muted-foreground">
          (formule {u.quota}
          {u.bonus ? ` + ${u.bonus} offertes` : ''})
        </span>
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setPhotos(String(u.bonus || ''))
          setNote('')
          setOpen(true)
        }}
      >
        <Gift aria-hidden />
        Offrir des photos
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Photos offertes ce mois-ci</DialogTitle>
            <DialogDescription>
              Analyses en plus du quota de la formule, pour {u.month} seulement. Remplace le supplément déjà accordé ce mois-ci.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={photos !== '' && !valid}>
              <FieldLabel htmlFor={`${id}-photos`}>Nombre de photos</FieldLabel>
              <Input id={`${id}-photos`} inputMode="numeric" value={photos} onChange={(e) => setPhotos(e.target.value)} placeholder="100" />
              <FieldDescription>0 retire le supplément.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-note`}>Note (facultative)</FieldLabel>
              <Input
                id={`${id}-note`}
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Geste commercial"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button disabled={!valid || save.isPending} onClick={() => save.mutate(undefined)}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
