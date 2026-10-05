import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MoneyField, Section } from './fields'
import { draftInvalid, type PayDraft } from './pay-draft'

/**
 * Champs des conditions de rémunération : formulaires, commission, paliers d'objectif,
 * prime du chef. Partagés par la mission et le type de mission.
 */
export function PayFields({
  draft,
  onChange,
  commission,
  lead,
  id,
}: {
  draft: PayDraft
  onChange: (d: PayDraft) => void
  /** Commission proposée (somme d'un champ nombre) */
  commission: boolean
  /** Prime du chef proposée (missions de groupe) */
  lead: boolean
  id: string
}) {
  const set = (patch: Partial<PayDraft>) => onChange({ ...draft, ...patch })
  const invalid = draftInvalid(draft)
  return (
    <div className="flex flex-col gap-4">
      <Section title="Formulaires">
        <div className="grid gap-3 sm:grid-cols-2">
          <MoneyField id={`${id}-form`} label="Par formulaire accepté" value={draft.perForm} onChange={(v) => set({ perForm: v })} />
          {commission && (
            <MoneyField
              id={`${id}-commission`}
              label="Commission sur les montants"
              suffix="%"
              value={draft.commission}
              onChange={(v) => set({ commission: v })}
            />
          )}
        </div>
        {invalid && <p className="text-xs text-destructive">{invalid}</p>}
      </Section>
      <Section title="Primes d’objectif" hint="À l’échéance de la mission : le palier le plus haut atteint est versé.">
        {draft.tiers.map((x, i) => (
          <div key={i} className="flex items-end gap-2">
            <MoneyField
              id={`${id}-tier-t-${i}`}
              label="Objectif atteint à"
              suffix="%"
              value={x.threshold}
              onChange={(v) => set({ tiers: draft.tiers.map((y, j) => (j === i ? { ...y, threshold: v } : y)) })}
            />
            <MoneyField
              id={`${id}-tier-a-${i}`}
              label="Prime"
              value={x.amount}
              onChange={(v) => set({ tiers: draft.tiers.map((y, j) => (j === i ? { ...y, amount: v } : y)) })}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Retirer ce palier"
              onClick={() => set({ tiers: draft.tiers.filter((_, j) => j !== i) })}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={draft.tiers.length >= 5}
          onClick={() => set({ tiers: [...draft.tiers, { threshold: '100', amount: '' }] })}
        >
          <Plus aria-hidden /> Ajouter un palier
        </Button>
      </Section>
      {lead && (
        <Section title="Chef d’équipe" hint="Pour les missions de groupe.">
          <MoneyField
            id={`${id}-lead`}
            label="Par formulaire accepté de son équipe"
            value={draft.lead}
            onChange={(v) => set({ lead: v })}
          />
        </Section>
      )}
    </div>
  )
}
