import { ProgressMethod } from '@suivi/shared'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { dateInput, dueFromInput } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import type { MissionDetail } from '@/lib/types'

/**
 * Modification d'une mission : titre, consignes, objectif et échéance. Le type, l'assignation
 * et la méthode restent ceux de la création (les formulaires déjà reçus restent valables).
 */
export function MissionEditDialog({
  mission,
  open,
  onOpenChange,
}: {
  mission: MissionDetail
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {open && <EditForm mission={mission} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function EditForm({ mission, onDone }: { mission: MissionDetail; onDone: () => void }) {
  const initialDue = mission.dueDate ? dateInput(new Date(mission.dueDate)) : ''
  const manual = mission.progressMethod === ProgressMethod.Manual
  const [title, setTitle] = useState(mission.title)
  const [description, setDescription] = useState(mission.description ?? '')
  const [target, setTarget] = useState(mission.targetValue != null ? String(mission.targetValue) : '')
  const [dueDate, setDueDate] = useState(initialDue)
  const [error, setError] = useState<string | null>(null)
  const today = dateInput()

  const save = useApiMutation(
    () =>
      api.patch(`/missions/${mission.id}`, {
        title: title.trim(),
        description: description.trim(),
        ...(manual ? {} : { targetValue: Number(target.replace(',', '.')) }),
        // Échéance inchangée : renvoyée telle quelle (même si elle est déjà passée).
        ...(dueDate && dueDate !== initialDue ? { dueDate: dueFromInput(dueDate) } : {}),
      }),
    { success: 'Mission mise à jour', invalidate: [['missions']], onSuccess: onDone },
  )

  const submit = () => {
    if (!title.trim()) return setError('Donnez un titre à la mission.')
    if (!manual && !(Number(target.replace(',', '.')) > 0)) return setError('L’objectif doit être un nombre supérieur à 0.')
    if (dueDate !== initialDue && dueDate && dueDate < today) return setError('L’échéance ne peut pas être une date passée.')
    setError(null)
    save.mutate(undefined)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Modifier la mission</DialogTitle>
        <DialogDescription>Le type, l’assignation et la méthode de calcul ne changent pas.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="edit-title">Titre</FieldLabel>
          <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="edit-desc">Consignes (facultatif)</FieldLabel>
          <Textarea id="edit-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {!manual && (
          <Field>
            <FieldLabel htmlFor="edit-target">Objectif</FieldLabel>
            <Input id="edit-target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="edit-due">Échéance</FieldLabel>
          <Input
            id="edit-due"
            type="date"
            min={initialDue && initialDue < today ? initialDue : today}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          {initialDue && initialDue < today && (
            <FieldDescription>Échéance dépassée : choisissez une nouvelle date pour prolonger la mission.</FieldDescription>
          )}
        </Field>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </FieldGroup>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button disabled={save.isPending} onClick={submit}>
          {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Enregistrer
        </Button>
      </DialogFooter>
    </>
  )
}
