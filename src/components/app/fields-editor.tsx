import { FieldType, type MissionField } from '@suivi/shared'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { fieldTypeLabel } from '@/lib/labels'

export interface DraftField extends MissionField {
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

export const toDrafts = (fields: MissionField[] = []): DraftField[] =>
  fields.map((f) => ({ ...f, optionsText: (f.options ?? []).join('\n') }))

export const fromDrafts = (drafts: DraftField[]): MissionField[] =>
  drafts.map(({ optionsText, ...f }) => ({
    ...f,
    label: f.label.trim(),
    options:
      f.type === FieldType.Select
        ? optionsText
            .split('\n')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined,
  }))

/** Ce qui empêche d'enregistrer les champs, ou null. */
export function fieldsError(drafts: DraftField[]): string | null {
  const keys = drafts.map((f) => f.key)
  if (drafts.some((f) => !f.label.trim())) return 'Chaque champ doit avoir un libellé.'
  if (new Set(keys).size !== keys.length) return 'Deux champs ont le même identifiant : renommez l’un d’eux.'
  if (drafts.some((f) => f.type === FieldType.Select && !f.optionsText.trim()))
    return 'Les listes de choix doivent proposer au moins une option.'
  return null
}

/**
 * Éditeur de champs personnalisés (formulaires de mission, fiche des points de vente) :
 * libellé, type, options, obligatoire, ordre.
 */
export function FieldsEditor({
  fields,
  onChange,
  savedKeys = [],
  title = 'Champs du formulaire',
  emptyText,
}: {
  fields: DraftField[]
  onChange: (fields: DraftField[]) => void
  /** Identifiants déjà enregistrés : ils ne changent plus (les réponses y sont rattachées). */
  savedKeys?: string[]
  title?: string
  emptyText: string
}) {
  const update = (index: number, patch: Partial<DraftField>) => onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  const move = (index: number, delta: number) => {
    const next = [...fields]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange([...fields, { key: '', label: '', type: FieldType.Text, required: false, optionsText: '' }])}
        >
          <Plus aria-hidden /> Ajouter un champ
        </Button>
      </div>
      {fields.length === 0 && <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">{emptyText}</p>}
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
                    ...(f.key && savedKeys.includes(f.key) ? {} : { key: slugify(e.target.value) }),
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
              <Textarea id={`f-${i}-options`} rows={3} value={f.optionsText} onChange={(e) => update(i, { optionsText: e.target.value })} />
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
              <Button variant="ghost" size="icon-sm" aria-label="Descendre" disabled={i === fields.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Supprimer le champ"
                onClick={() => onChange(fields.filter((_, j) => j !== i))}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
