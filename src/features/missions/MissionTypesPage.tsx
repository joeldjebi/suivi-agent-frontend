import { Feature, FieldType, type MissionField } from '@suivi/shared'
import { ArrowDown, ArrowUp, Coins, Loader2, PenLine, Plus, Shapes, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { IMPACT_LABELS, RemoveDialog } from '@/components/app/remove-dialog'
import { StatusPill } from '@/components/app/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { fieldTypeLabel } from '@/lib/labels'
import { useApiMutation, useMissionTypes } from '@/lib/queries'
import { useFeature } from '@/lib/subscription'
import type { MissionType } from '@/lib/types'
import { ExportButton } from '@/components/app/export-button'
import { PayFields } from '../payroll/PayFields'
import { describePay, draftFrom, draftInvalid, payFromDraft, type PayDraft } from '../payroll/pay-draft'
import { CircleSlash } from 'lucide-react'

interface DraftField extends MissionField {
  /** Texte saisi pour les options d'une liste (une par ligne). */
  optionsText: string
}

/** « Montant collecté (FCFA) » → « montant_collecte_fcfa » */
function slugify(label: string): string {
  const slug = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
  return /^[a-z]/.test(slug) ? slug : `champ_${slug}`.slice(0, 50)
}

function TypeDialog({ open, onOpenChange, type }: { open: boolean; onOpenChange: (o: boolean) => void; type?: MissionType }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <TypeForm type={type} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function TypeForm({ type, onDone }: { type?: MissionType; onDone: () => void }) {
  const [name, setName] = useState(type?.name ?? '')
  const [description, setDescription] = useState(type?.description ?? '')
  const [fields, setFields] = useState<DraftField[]>(() =>
    (type?.fields ?? []).map((f) => ({ ...f, optionsText: (f.options ?? []).join('\n') })),
  )
  const [error, setError] = useState<string | null>(null)
  // Rémunération (formule Entreprise) : la grille de chaque agent par défaut.
  const payroll = useFeature(Feature.Payroll)
  const [ownPay, setOwnPay] = useState(!!type?.pay)
  const [pay, setPay] = useState<PayDraft>(() => draftFrom(type?.pay))
  const hasNumber = fields.some((f) => f.type === FieldType.Number)

  const update = (index: number, patch: Partial<DraftField>) =>
    setFields((list) => list.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  const move = (index: number, delta: number) =>
    setFields((list) => {
      const next = [...list]
      const [item] = next.splice(index, 1)
      next.splice(index + delta, 0, item)
      return next
    })

  const save = useApiMutation(
    () => {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        fields: fields.map(({ optionsText, ...f }) => ({
          ...f,
          label: f.label.trim(),
          options:
            f.type === FieldType.Select
              ? optionsText
                  .split('\n')
                  .map((o) => o.trim())
                  .filter(Boolean)
              : undefined,
        })),
      }
      return (async () => {
        const saved = type ? await api.patch(`/mission-types/${type.id}`, body) : await api.post<MissionType>('/mission-types', body)
        const id = type?.id ?? (saved.data as MissionType).id
        if (payroll && ownPay) {
          const p = payFromDraft(pay)
          await api.put(`/mission-types/${id}/pay`, { ...p, commissionPercent: hasNumber ? p.commissionPercent : null })
        } else if (payroll && type?.pay) {
          await api.delete(`/mission-types/${id}/pay`)
        }
        return saved
      })()
    },
    { success: type ? 'Type mis à jour' : 'Type créé', invalidate: [['mission-types'], ['missions'], ['pay']], onSuccess: onDone },
  )

  const submit = () => {
    const keys = fields.map((f) => f.key)
    if (!name.trim()) return setError('Donnez un nom au type de mission.')
    if (fields.some((f) => !f.label.trim())) return setError('Chaque champ doit avoir un libellé.')
    if (new Set(keys).size !== keys.length) return setError('Deux champs ont le même identifiant : renommez l’un d’eux.')
    if (fields.some((f) => f.type === FieldType.Select && !f.optionsText.trim())) {
      return setError('Les listes de choix doivent proposer au moins une option.')
    }
    if (payroll && ownPay && draftInvalid(pay)) return setError(draftInvalid(pay))
    setError(null)
    save.mutate(undefined)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{type ? 'Modifier le type de mission' : 'Nouveau type de mission'}</DialogTitle>
        <DialogDescription>Les champs définis ici génèrent automatiquement le formulaire dans l'app mobile.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="type-name">Nom</FieldLabel>
            <Input id="type-name" autoFocus placeholder="Ex. : Prospection" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="type-description">Description (facultatif)</FieldLabel>
            <Input id="type-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Champs du formulaire</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFields((list) => [...list, { key: '', label: '', type: FieldType.Text, required: false, optionsText: '' }])}
            >
              <Plus aria-hidden /> Ajouter un champ
            </Button>
          </div>
          {fields.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              Aucun champ : l'agent pourra seulement valider sa visite.
            </p>
          )}
          {fields.map((f, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
                <Field>
                  <FieldLabel htmlFor={`f-${i}-label`}>Libellé</FieldLabel>
                  <Input
                    id={`f-${i}-label`}
                    value={f.label}
                    placeholder="Ex. : Montant collecté (FCFA)"
                    onChange={(e) =>
                      update(i, {
                        label: e.target.value,
                        ...(type?.fields.some((tf) => tf.key === f.key && f.key) ? {} : { key: slugify(e.target.value) }),
                      })
                    }
                  />
                  {f.key && <FieldDescription>Identifiant : {f.key}</FieldDescription>}
                </Field>
                <Field>
                  <FieldLabel>Type</FieldLabel>
                  <Select value={f.type} onValueChange={(v) => v && update(i, { type: v as FieldType })}>
                    <SelectTrigger className="w-full" aria-label={`Type du champ ${i + 1}`}>
                      <SelectValue>{(v: FieldType) => fieldTypeLabel[v]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(FieldType).map((t) => (
                        <SelectItem key={t} value={t}>
                          {fieldTypeLabel[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {f.type === FieldType.Select && (
                <Field>
                  <FieldLabel htmlFor={`f-${i}-options`}>Options (une par ligne)</FieldLabel>
                  <Textarea
                    id={`f-${i}-options`}
                    rows={3}
                    value={f.optionsText}
                    onChange={(e) => update(i, { optionsText: e.target.value })}
                  />
                </Field>
              )}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={f.required} onCheckedChange={(c) => update(i, { required: c })} />
                  Obligatoire
                </label>
                <div className="flex">
                  <Button variant="ghost" size="icon-sm" aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Descendre"
                    disabled={i === fields.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Supprimer le champ"
                    onClick={() => setFields((l) => l.filter((_, j) => j !== i))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {payroll && (
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex flex-col gap-0.5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Coins className="size-4 text-muted-foreground" aria-hidden /> Rémunération des missions de ce type
              </p>
              <p className="text-xs text-muted-foreground">
                Par défaut, chaque agent est payé selon sa grille. Des conditions propres au type remplacent la grille pour les formulaires
                et l’objectif de toutes ses missions ; une mission peut encore avoir les siennes.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Rémunération des missions de ce type">
              {(
                [
                  [false, 'Grille de chaque agent', 'Le système actuel, sans rien régler.'],
                  [true, 'Conditions propres à ce type', 'Prix par formulaire, commission, primes.'],
                ] as const
              ).map(([value, label, hint]) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={ownPay === value}
                  onClick={() => setOwnPay(value)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted/50',
                    ownPay === value && 'border-primary bg-primary/5 ring-1 ring-primary',
                  )}
                >
                  <span className="font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">{hint}</span>
                </button>
              ))}
            </div>
            {ownPay && <PayFields draft={pay} onChange={setPay} commission={hasNumber} lead id="tp" />}
          </div>
        )}
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
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Enregistrer
        </Button>
      </DialogFooter>
    </>
  )
}

export function MissionTypesPage() {
  const types = useMissionTypes(true)
  const payroll = useFeature(Feature.Payroll)
  const [dialog, setDialog] = useState<{ open: boolean; type?: MissionType }>({ open: false })
  const [removing, setRemoving] = useState<MissionType | null>(null)
  const toggleActive = useApiMutation((t: MissionType) => api.patch(`/mission-types/${t.id}`, { isActive: !t.isActive }), {
    invalidate: [['mission-types']],
  })

  return (
    <Page>
      <PageHeader
        title="Types de missions"
        description="Collecte, prospection… Chaque type définit les champs du formulaire rempli par l'agent."
        actions={
          <Button onClick={() => setDialog({ open: true })}>
            <Plus aria-hidden /> Nouveau type
          </Button>
        }
      />
      <QueryState query={types}>
        {!types.data?.length ? (
          <EmptyState icon={Shapes} title="Aucun type de mission" description="Créez un type pour pouvoir assigner des missions." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {types.data.map((t) => (
              <article key={t.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 font-semibold">
                      {t.name}
                      {!t.isActive && <StatusPill tone="ended" icon={CircleSlash} label="Désactivé" />}
                    </h2>
                    {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                  </div>
                  <div className="flex">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Modifier ${t.name}`}
                      onClick={() => setDialog({ open: true, type: t })}
                    >
                      <PenLine aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Désactiver ou supprimer ${t.name}`} onClick={() => setRemoving(t)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {t.fields.length === 0 && <span className="text-sm text-muted-foreground">Aucun champ</span>}
                  {t.fields.map((f) => (
                    <Badge key={f.key} variant="secondary">
                      {f.label}
                      <span className="text-muted-foreground">
                        · {fieldTypeLabel[f.type]}
                        {f.required ? ' *' : ''}
                      </span>
                    </Badge>
                  ))}
                </div>
                {payroll && (
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Coins className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {t.pay
                      ? describePay(t.pay).join(' · ') || 'Conditions propres : rien en plus du fixe'
                      : 'Rémunération : grille de chaque agent'}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={t.isActive} disabled={toggleActive.isPending} onCheckedChange={() => toggleActive.mutate(t)} />
                    Proposé pour les nouvelles missions
                  </label>
                  <ExportButton
                    size="sm"
                    path="/exports/submissions"
                    params={{ typeId: t.id }}
                    description={`Formulaires de toutes les missions « ${t.name} »`}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </QueryState>
      <TypeDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} type={dialog.type} />
      <RemoveDialog
        target={removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        config={
          removing && {
            noun: 'le type de mission',
            url: `/mission-types/${removing.id}`,
            deactivateEffect: 'Il n’est plus proposé pour les nouvelles missions ; les missions existantes continuent.',
            impactLabels: IMPACT_LABELS.missionType,
            invalidate: [['mission-types'], ['missions']],
          }
        }
      />
    </Page>
  )
}
