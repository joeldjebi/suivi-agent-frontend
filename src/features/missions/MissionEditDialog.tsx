import { ProgressMethod, VisitMode } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { dateInput, dueFromInput } from '@/lib/format'
import { useMe } from '@/lib/auth'
import { useAgents, useApiMutation, useGroups, useZones } from '@/lib/queries'
import type { MissionDetail } from '@/lib/types'
import { OutletPicker } from '../outlets/OutletPicker'
import { eligibleZones, ZonePicker, type Assignment } from './ZonePicker'

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
  const { settings } = useMe()
  const zones = useZones()
  const groups = useGroups()
  const agents = useAgents()
  const initialZones = (mission.zones ?? []).map((z) => z.id)
  const [zoneIds, setZoneIds] = useState<string[]>(initialZones)
  const assignment: Assignment = mission.assigneeGroupId
    ? { kind: 'group', groupId: mission.assigneeGroupId }
    : mission.assigneeAgentId
      ? { kind: 'agent', groupId: agents.data?.find((a) => a.id === mission.assigneeAgentId)?.groupId ?? null }
      : { kind: 'open' }
  // Zones permises, plus celles déjà retenues (pour pouvoir les retirer).
  const eligible = [
    ...eligibleZones(zones.data ?? [], assignment, settings.useGroups),
    ...(zones.data ?? []).filter(
      (z) => initialZones.includes(z.id) && !eligibleZones(zones.data ?? [], assignment, settings.useGroups).some((e) => e.id === z.id),
    ),
  ]
  const zonesChanged = zoneIds.length !== initialZones.length || zoneIds.some((id) => !initialZones.includes(id))
  // Liste précise de points de vente : modifiable, l'objectif suit.
  const listVisits = mission.visitMode === VisitMode.List
  const listed = useQuery({
    queryKey: ['missions', mission.id, 'outlets'],
    enabled: listVisits,
    queryFn: async () => (await api.get<{ id: string }[]>(`/missions/${mission.id}/outlets`)).data,
  })
  const [outletIds, setOutletIds] = useState<string[] | null>(null)
  const currentOutlets = outletIds ?? listed.data?.map((o) => o.id) ?? []

  const save = useApiMutation(
    () =>
      api.patch(`/missions/${mission.id}`, {
        title: title.trim(),
        description: description.trim(),
        ...(manual || listVisits ? {} : { targetValue: Number(target.replace(',', '.')) }),
        ...(listVisits && outletIds ? { outletIds } : {}),
        // Échéance inchangée : renvoyée telle quelle (même si elle est déjà passée).
        ...(dueDate && dueDate !== initialDue ? { dueDate: dueFromInput(dueDate) } : {}),
        ...(zonesChanged ? { zoneIds } : {}),
      }),
    { success: 'Mission mise à jour', invalidate: [['missions']], onSuccess: onDone },
  )

  const submit = () => {
    if (!title.trim()) return setError('Donnez un titre à la mission.')
    if (!manual && !listVisits && !(Number(target.replace(',', '.')) > 0)) return setError('L’objectif doit être un nombre supérieur à 0.')
    if (listVisits && outletIds && !outletIds.length) return setError('Gardez au moins un point de vente à visiter.')
    if (dueDate !== initialDue && dueDate && dueDate < today) return setError('L’échéance ne peut pas être une date passée.')
    if (!zoneIds.length) return setError('Choisissez au moins une zone où la mission se fait.')
    setError(null)
    save.mutate(undefined)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Modifier la mission</DialogTitle>
        <DialogDescription>Le type, l’affectation et la méthode de calcul ne changent pas.</DialogDescription>
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
        {!manual && !listVisits && (
          <Field>
            <FieldLabel htmlFor="edit-target">{mission.visitMode ? 'Points de vente à visiter' : 'Objectif'}</FieldLabel>
            <Input id="edit-target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
        )}
        {listVisits && (
          <Field>
            <FieldLabel>Points de vente à visiter</FieldLabel>
            <OutletPicker zoneIds={zoneIds} value={currentOutlets} onChange={setOutletIds} />
          </Field>
        )}
        <Field>
          <FieldLabel>Zones</FieldLabel>
          <ZonePicker
            zones={eligible}
            value={zoneIds}
            onChange={setZoneIds}
            groupName={(id) => groups.data?.find((g) => g.id === id)?.name}
          />
        </Field>
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
