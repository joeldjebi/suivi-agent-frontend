import type { PayGridComponents, PayPeriod, PayRunStatus } from '@suivi/shared'
import { formatMoney } from '@/lib/subscription'
import type { PayRunDetail } from '@/lib/types'

export const periodKindLabel: Record<PayPeriod, string> = {
  weekly: 'Chaque semaine (lundi → dimanche)',
  biweekly: 'Chaque quinzaine (1–15, 16–fin du mois)',
  monthly: 'Chaque mois',
}

export const runStatusLabel: Record<PayRunStatus, string> = {
  draft: 'À valider',
  validated: 'Validée, à payer',
  paid: 'Payée',
}

/** Résumé lisible d'une grille : « Fixe 50 000 · 3 000 / journée · 200 / formulaire… » */
export function describeGrid(c: PayGridComponents, currency = 'XOF'): string[] {
  const m = (n: number) => formatMoney(n, currency)
  const parts: string[] = []
  if (c.fixed) parts.push(`Fixe ${m(c.fixed)}`)
  if (c.perDay?.amount)
    parts.push(
      `${m(c.perDay.amount)} / journée${c.perDay.minHours ? ` (≥ ${c.perDay.minHours} h)` : ''}${c.perDay.requireInZone ? ' dans la zone' : ''}`,
    )
  if (c.perForm?.amount || Object.keys(c.perForm?.byType ?? {}).length)
    parts.push(`${c.perForm?.amount ? m(c.perForm.amount) : 'selon le type'} / formulaire`)
  if (c.commission?.percent) parts.push(`Commission ${c.commission.percent} %`)
  for (const t of c.objectiveBonus ?? []) parts.push(`Prime ${m(t.amount)} à ${t.thresholdPercent} % d’objectif`)
  if (c.teamBonus?.perTeamDay) parts.push(`${m(c.teamBonus.perTeamDay)} / journée d’équipe`)
  if (c.teamBonus?.perTeamForm) parts.push(`${m(c.teamBonus.perTeamForm)} / formulaire d’équipe`)
  const d = c.deductions
  if (d?.perAutoClosedDay) parts.push(`−${m(d.perAutoClosedDay)} / journée non clôturée`)
  if (d?.perRejectedForm) parts.push(`−${m(d.perRejectedForm)} / formulaire rejeté`)
  if (d?.perMockedDay) parts.push(`−${m(d.perMockedDay)} / position simulée`)
  if (c.cap) parts.push(`Plafond ${m(c.cap)}`)
  return parts
}

function download(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Fichier de paiement en masse (Mobile Money, banque) : numéro, nom, montant, référence. */
export function exportPayments(run: PayRunDetail) {
  const lines = run.lines.filter((l) => l.total > 0 && !l.paidAt)
  download(`paiements-${run.periodStart}.csv`, [
    ['Numéro', 'Nom', 'Montant', 'Devise', 'Référence'],
    ...lines.map((l) => [l.phone ?? '', `${l.firstName} ${l.lastName}`, l.total, run.currency, `Paie ${run.label}`]),
  ])
}

/** Export détaillé pour le comptable (la paie légale reste hors de la plateforme). */
export function exportAccounting(run: PayRunDetail) {
  download(`remuneration-${run.periodStart}.csv`, [
    ['Nom', 'Prénom', 'Rôle', 'Groupe', 'Période', 'Grille', 'Détail', 'Brut', 'Ajustements', 'Net', 'Payé le', 'Référence'],
    ...run.lines.map((l) => [
      l.lastName,
      l.firstName,
      l.role === 'team_lead' ? 'Chef d’équipe' : 'Agent',
      l.groupName ?? '',
      run.label,
      l.gridName ?? 'Aucune',
      l.items.map((i) => `${i.label} : ${i.amount}`).join(' | '),
      l.gross,
      l.adjustments,
      l.total,
      l.paidAt ? l.paidAt.slice(0, 10) : '',
      l.paymentReference ?? '',
    ]),
  ])
}

export const RUN_TONE: Record<PayRunStatus, 'paused' | 'info' | 'active'> = {
  draft: 'paused',
  validated: 'info',
  paid: 'active',
}
