import { FieldType, ProgressMethod, Role } from '@suivi/shared'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { dateInput, dueFromInput, fullName } from '@/lib/format'
import { progressMethodLabel } from '@/lib/labels'
import { useAgents, useApiMutation, useGroups, useMissionTypes, useZones } from '@/lib/queries'
import type { Mission } from '@/lib/types'
import { eligibleZones, ZonePicker, type Assignment } from './ZonePicker'

export function MissionFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <MissionForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function MissionForm({ onDone }: { onDone: () => void }) {
  const { user, settings } = useMe()
  const navigate = useNavigate()
  const types = useMissionTypes()
  const agents = useAgents()
  const groups = useGroups()
  const zones = useZones()
  const [zoneIds, setZoneIds] = useState<string[]>([])
  const [typeId, setTypeId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignTo, setAssignTo] = useState<'agent' | 'group' | 'open'>('agent')
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [method, setMethod] = useState<ProgressMethod>(ProgressMethod.Count)
  const [target, setTarget] = useState('')
  const [sumField, setSumField] = useState<string | null>(null)
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const type = types.data?.find((t) => t.id === typeId)
  const numberFields = type?.fields.filter((f) => f.type === FieldType.Number) ?? []
  const canAssignGroup = settings.useGroups && (groups.data?.length ?? 0) > 0
  const assignment: Assignment =
    assignTo === 'open'
      ? { kind: 'open' }
      : assignTo === 'group'
        ? { kind: 'group', groupId: assigneeId ?? '' }
        : { kind: 'agent', groupId: agents.data?.find((a) => a.id === assigneeId)?.groupId ?? null }
  const eligible = eligibleZones(zones.data ?? [], assignment, settings.useGroups)
  // Zones retenues : seulement celles encore permises par l'affectation choisie.
  const chosenZones = zoneIds.filter((id) => eligible.some((z) => z.id === id))

  const create = useApiMutation(
    () =>
      api.post<Mission>('/missions', {
        typeId,
        title: title.trim(),
        description: description.trim() || undefined,
        zoneIds: chosenZones,
        assigneeAgentId: assignTo === 'agent' ? assigneeId : undefined,
        assigneeGroupId: assignTo === 'group' ? assigneeId : undefined,
        progressMethod: method,
        targetValue: method === ProgressMethod.Manual ? undefined : Number(target.replace(',', '.')),
        sumFieldKey: method === ProgressMethod.FieldSum ? sumField : undefined,
        dueDate: dueDate ? dueFromInput(dueDate) : undefined,
      }),
    {
      success: 'Mission créée, les agents ont été notifiés',
      invalidate: [['missions']],
      onSuccess: (res) => {
        onDone()
        void navigate(`/missions/${res.data.id}`)
      },
    },
  )

  const submit = () => {
    const value = Number(target.replace(',', '.'))
    if (!typeId) return setError('Choisissez un type de mission.')
    if (!title.trim()) return setError('Donnez un titre à la mission.')
    if (assignTo !== 'open' && !assigneeId) return setError(assignTo === 'agent' ? 'Choisissez un agent.' : 'Choisissez un groupe.')
    if (!chosenZones.length) return setError('Choisissez au moins une zone où la mission se fait.')
    if (method !== ProgressMethod.Manual && !(value > 0)) return setError('L’objectif doit être un nombre supérieur à 0.')
    if (method === ProgressMethod.FieldSum && !sumField) return setError('Choisissez le champ à additionner.')
    if (dueDate && dueDate < dateInput()) return setError('L’échéance ne peut pas être une date passée.')
    setError(null)
    create.mutate(undefined)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nouvelle mission</DialogTitle>
        <DialogDescription>Chaque mission a un objectif clair et mesurable.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel>Type de mission</FieldLabel>
          <Select
            value={typeId}
            onValueChange={(v) => {
              setTypeId(v)
              setSumField(null)
            }}
          >
            <SelectTrigger className="w-full" aria-label="Type de mission">
              <SelectValue placeholder="Choisir un type">{(v: string | null) => types.data?.find((t) => t.id === v)?.name}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {types.data?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {types.data?.length === 0 && (
            <FieldDescription>
              {user.role === Role.Admin
                ? 'Créez d’abord un type de mission.'
                : 'Aucun type de mission : demandez à un administrateur d’en créer.'}
            </FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="mission-title">Titre</FieldLabel>
          <Input id="mission-title" placeholder="Ex. : 50 visites cette semaine" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="mission-desc">Consignes (facultatif)</FieldLabel>
          <Textarea id="mission-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <Field>
          <FieldLabel>Assignée à</FieldLabel>
          <Tabs
            value={assignTo}
            onValueChange={(v) => {
              setAssignTo(v as typeof assignTo)
              setAssigneeId(null)
            }}
          >
            <TabsList className="w-full">
              <TabsTrigger value="agent">Un agent</TabsTrigger>
              {canAssignGroup && <TabsTrigger value="group">Un groupe</TabsTrigger>}
              <TabsTrigger value="open">Ouverte</TabsTrigger>
            </TabsList>
          </Tabs>
          {assignTo !== 'open' && (
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className="w-full" aria-label={assignTo === 'agent' ? 'Agent' : 'Groupe'}>
                <SelectValue placeholder={assignTo === 'agent' ? 'Choisir un agent' : 'Choisir un groupe'}>
                  {(v: string | null) =>
                    assignTo === 'agent' ? fullName(agents.data?.find((a) => a.id === v)) : groups.data?.find((g) => g.id === v)?.name
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {assignTo === 'agent'
                  ? agents.data
                      ?.filter((a) => a.isActive)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {fullName(a)}
                        </SelectItem>
                      ))
                  : groups.data?.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          )}
          {assignTo === 'group' && <FieldDescription>Objectif collectif : la contribution de chaque agent reste visible.</FieldDescription>}
          {assignTo === 'open' && (
            <FieldDescription>Objectif collectif ouvert à tous les agents qui choisissent une de ses zones.</FieldDescription>
          )}
        </Field>

        <Field>
          <FieldLabel>Zones</FieldLabel>
          <ZonePicker
            zones={eligible}
            value={chosenZones}
            onChange={setZoneIds}
            groupName={(id) => groups.data?.find((g) => g.id === id)?.name}
          />
          <FieldDescription>L’agent voit la mission en choisissant l’une de ces zones, et y envoie ses formulaires.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Mesure de l'objectif</FieldLabel>
          <Select value={method} onValueChange={(v) => v && setMethod(v as ProgressMethod)}>
            <SelectTrigger className="w-full" aria-label="Mesure de l'objectif">
              <SelectValue>{(v: ProgressMethod) => progressMethodLabel[v]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.values(ProgressMethod).map((m) => (
                <SelectItem key={m} value={m} disabled={m === ProgressMethod.FieldSum && !numberFields.length}>
                  {progressMethodLabel[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            {method === ProgressMethod.Count && 'Chaque formulaire accepté compte pour 1.'}
            {method === ProgressMethod.FieldSum && 'Les valeurs d’un champ numérique sont additionnées.'}
            {method === ProgressMethod.Manual && 'Le chef d’équipe indique si l’objectif est atteint.'}
          </FieldDescription>
        </Field>
        {method === ProgressMethod.FieldSum && (
          <Field>
            <FieldLabel>Champ à additionner</FieldLabel>
            <Select value={sumField} onValueChange={setSumField}>
              <SelectTrigger className="w-full" aria-label="Champ à additionner">
                <SelectValue placeholder="Choisir un champ">
                  {(v: string | null) => numberFields.find((f) => f.key === v)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {numberFields.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {method !== ProgressMethod.Manual && (
            <Field>
              <FieldLabel htmlFor="mission-target">Objectif</FieldLabel>
              <Input
                id="mission-target"
                inputMode="decimal"
                placeholder="Ex. : 50"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="mission-due">Échéance (facultatif)</FieldLabel>
            <Input id="mission-due" type="date" min={dateInput()} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
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
        <Button onClick={submit} disabled={create.isPending}>
          {create.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Créer la mission
        </Button>
      </DialogFooter>
    </>
  )
}
