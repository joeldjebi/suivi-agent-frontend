import { FieldType, type MissionField, PRODUCT_MEASURE_LABELS, type ProductFieldConfig, ProductMeasure, ProductScope } from '@suivi/shared'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { productName, useProducts } from '@/features/products/products'
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
  const products = drafts.find(
    (f) =>
      f.type === FieldType.Products &&
      (!f.products?.measures.length || (f.products.scope === ProductScope.Selected && !f.products.productIds?.length)),
  )
  if (products) return `Le relevé « ${products.label || 'par produit'} » doit avoir des produits et au moins une mesure.`
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
  allowProducts = false,
}: {
  fields: DraftField[]
  onChange: (fields: DraftField[]) => void
  /** Identifiants déjà enregistrés : ils ne changent plus (les réponses y sont rattachées). */
  savedKeys?: string[]
  title?: string
  emptyText: string
  /** Relevé par produit (formulaires de mission, formule qui l'inclut) */
  allowProducts?: boolean
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
              <Select
                value={f.type}
                onValueChange={(v) =>
                  v &&
                  update(i, {
                    type: v as FieldType,
                    ...(v === FieldType.Products && !f.products ? { products: DEFAULT_PRODUCTS } : {}),
                  })
                }
              >
                <SelectTrigger className="w-full" aria-label={`Type du champ ${i + 1}`}>
                  <SelectValue>{(v: FieldType) => fieldTypeLabel[v]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.values(FieldType)
                    .filter((t) => t !== FieldType.Products || allowProducts)
                    .map((t) => (
                      <SelectItem key={t} value={t}>
                        {fieldTypeLabel[t]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {f.type === FieldType.Products && f.products && (
            <ProductFieldEditor config={f.products} onChange={(products) => update(i, { products })} />
          )}
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

const ALL_CATEGORIES = '__all__'

const DEFAULT_PRODUCTS: ProductFieldConfig = {
  scope: ProductScope.All,
  measures: [ProductMeasure.Presence, ProductMeasure.Stock, ProductMeasure.Price],
}

const SCOPES: [ProductScope, string][] = [
  [ProductScope.All, 'Tous les produits'],
  [ProductScope.Own, 'Nos produits'],
  [ProductScope.Competitor, 'Les concurrents'],
  [ProductScope.Selected, 'Une sélection'],
]

/** Relevé par produit : les produits concernés et ce que l'agent relève pour chacun. */
function ProductFieldEditor({ config, onChange }: { config: ProductFieldConfig; onChange: (config: ProductFieldConfig) => void }) {
  const products = useProducts()
  const all = products.data ?? []
  const categories = [...new Set(all.map((p) => p.category).filter((c): c is string => !!c))]
  const set = (patch: Partial<ProductFieldConfig>) => onChange({ ...config, ...patch })
  const selected = new Set(config.productIds ?? [])
  const concerned = all.filter(
    (p) =>
      (config.scope === ProductScope.All ||
        (config.scope === ProductScope.Own && p.own) ||
        (config.scope === ProductScope.Competitor && !p.own) ||
        (config.scope === ProductScope.Selected && selected.has(p.id))) &&
      (!config.category || p.category === config.category),
  )

  return (
    <div className="flex flex-col gap-3 rounded-md bg-muted/40 p-3">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">Produits relevés</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Produits relevés">
          {SCOPES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={config.scope === value}
              onClick={() => set({ scope: value })}
              className={cn(
                'h-8 rounded-full border bg-background px-3 text-xs font-medium hover:bg-muted',
                config.scope === value && 'border-primary bg-primary/10 text-primary',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {categories.length > 0 && config.scope !== ProductScope.Selected && (
          <Select value={config.category ?? ALL_CATEGORIES} onValueChange={(v) => set({ category: v && v !== ALL_CATEGORIES ? v : null })}>
            <SelectTrigger size="sm" className="w-60" aria-label="Catégorie">
              <SelectValue>{(v: string) => (v !== ALL_CATEGORIES ? `Catégorie : ${v}` : 'Toutes les catégories')}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>Toutes les catégories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {config.scope === ProductScope.Selected ? (
          <ul className="flex max-h-48 flex-col divide-y overflow-y-auto rounded-md border bg-background">
            {all.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted">
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={(c) =>
                      set({
                        productIds: c ? [...selected, p.id] : [...selected].filter((id) => id !== p.id),
                      })
                    }
                  />
                  <span className="flex-1">{productName(p)}</span>
                  {!p.own && <span className="text-xs text-muted-foreground">concurrent</span>}
                </label>
              </li>
            ))}
            {all.length === 0 && <li className="p-3 text-center text-sm text-muted-foreground">Le catalogue est vide.</li>}
          </ul>
        ) : (
          <FieldDescription>
            {concerned.length
              ? `${concerned.length} produit${concerned.length > 1 ? 's' : ''} aujourd’hui : ${concerned
                  .slice(0, 4)
                  .map(productName)
                  .join(', ')}${concerned.length > 4 ? '…' : ''}. Les produits ajoutés au catalogue y entrent d’eux-mêmes.`
              : 'Aucun produit du catalogue ne correspond pour le moment.'}
          </FieldDescription>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">Pour chaque produit, l’agent relève</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {Object.values(ProductMeasure).map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={config.measures.includes(m)}
                onCheckedChange={(c) => set({ measures: c ? [...config.measures, m] : config.measures.filter((x) => x !== m) })}
              />
              {PRODUCT_MEASURE_LABELS[m]}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
