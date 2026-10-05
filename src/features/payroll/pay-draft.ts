import type { MissionPay } from '@suivi/shared'
import { formatMoney } from '@/lib/subscription'
import { num, str, type Num } from './num'

/** Saisie des conditions de rémunération (mission ou type de mission). */
export interface PayDraft {
  perForm: Num
  commission: Num
  lead: Num
  tiers: { threshold: Num; amount: Num }[]
}

export function draftFrom(pay?: MissionPay | null): PayDraft {
  return {
    perForm: str(pay?.perForm),
    commission: str(pay?.commissionPercent),
    lead: str(pay?.leadPerTeamForm),
    tiers: (pay?.objectiveBonus ?? []).map((t) => ({ threshold: str(t.thresholdPercent), amount: str(t.amount) })),
  }
}

export function payFromDraft(d: PayDraft): MissionPay {
  return {
    perForm: num(d.perForm),
    commissionPercent: num(d.commission),
    leadPerTeamForm: num(d.lead),
    objectiveBonus: d.tiers
      .filter((t) => num(t.threshold) !== null && num(t.amount) !== null)
      .map((t) => ({ thresholdPercent: num(t.threshold)!, amount: num(t.amount)! })),
  }
}

export function draftInvalid(d: PayDraft): string | null {
  const percent = num(d.commission)
  if (percent !== null && (percent < 0 || percent > 100)) return 'La commission doit être comprise entre 0 et 100 %.'
  return null
}

/** Lignes lisibles des conditions. */
export function describePay(pay: MissionPay, sum = true): string[] {
  const lines: string[] = []
  if (pay.perForm) lines.push(`${formatMoney(pay.perForm)} par formulaire accepté`)
  if (sum && pay.commissionPercent) lines.push(`Commission de ${pay.commissionPercent.toLocaleString('fr-FR')} % sur les montants saisis`)
  for (const t of pay.objectiveBonus ?? []) lines.push(`Prime de ${formatMoney(t.amount)} à ${t.thresholdPercent} % de l’objectif`)
  if (pay.leadPerTeamForm) lines.push(`Chef d’équipe : ${formatMoney(pay.leadPerTeamForm)} par formulaire de son équipe`)
  return lines
}
