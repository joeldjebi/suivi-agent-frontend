import type { SubscriptionStatus } from '@suivi/shared'
import { CheckCircle2, CircleSlash, Clock, Hourglass, PauseCircle, type LucideIcon } from 'lucide-react'

export { formatMoney, planLabel, subscriptionStatusLabel } from '@/lib/subscription'

type Tone = 'active' | 'paused' | 'alert' | 'ended' | 'info'

export const statusTone: Record<SubscriptionStatus, [Tone, LucideIcon]> = {
  trialing: ['info', Hourglass],
  active: ['active', CheckCircle2],
  past_due: ['paused', Clock],
  suspended: ['alert', PauseCircle],
  cancelled: ['ended', CircleSlash],
}

export const paymentMethodLabel: Record<string, string> = {
  mobile_money: 'Mobile Money',
  transfer: 'Virement',
  cash: 'Espèces',
  other: 'Autre',
}

/** Libellés du journal de l'éditeur. */
export const auditActionLabel: Record<string, string> = {
  'auth.login': 'Connexion',
  'auth.login_failed': 'Connexion refusée',
  'auth.password': 'Mot de passe modifié',
  'auth.mfa_failed': 'Code de double authentification refusé',
  'auth.mfa_enabled': 'Double authentification activée',
  'auth.mfa_disabled': 'Double authentification désactivée',
  'auth.mfa_recovery_used': 'Code de secours utilisé',
  'auth.mfa_recovery_regenerated': 'Codes de secours renouvelés',
  'admin.mfa_reset': 'Double authentification réinitialisée',
  'plan.create': 'Formule créée',
  'plan.delete': 'Formule supprimée',
  'admin.create': 'Compte éditeur créé',
  'admin.enable': 'Compte éditeur réactivé',
  'admin.disable': 'Compte éditeur désactivé',
  'tenant.create': 'Structure créée',
  'tenant.update': 'Structure modifiée',
  'tenant.note': 'Note',
  'tenant.suspend': 'Structure suspendue',
  'tenant.reactivate': 'Structure réactivée',
  'subscription.update': 'Abonnement modifié',
  'invoice.paid': 'Paiement enregistré',
  'invoice.void': 'Facture annulée',
  'plan.update': 'Formule modifiée',
  'settings.update': 'Réglages modifiés',
}

/** « octobre 2026 » pour « 2026-10 ». */
export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month.slice(0, 7)}-15T12:00:00Z`),
  )

/** « oct. 26 » pour les axes de graphique. */
export const shortMonth = (month: string) =>
  new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`))

/** Résumé lisible d'une entrée du journal (motif, montant, champs). */
export function auditSummary(details: Record<string, unknown>): string {
  const parts: string[] = []
  if (typeof details.reason === 'string') parts.push(details.reason)
  if (typeof details.note === 'string') parts.push(details.note)
  if (typeof details.number === 'string') parts.push(`Facture ${details.number}`)
  if (typeof details.amount === 'number') parts.push(new Intl.NumberFormat('fr-FR').format(details.amount))
  if (typeof details.method === 'string') parts.push(paymentMethodLabel[details.method] ?? details.method)
  if (typeof details.reference === 'string') parts.push(`réf. ${details.reference}`)
  if (typeof details.email === 'string') parts.push(details.email)
  if (typeof details.name === 'string') parts.push(details.name)
  if (typeof details.code === 'string') parts.push(`formule ${details.code}`)
  if (details.after && typeof details.after === 'object') {
    const after = details.after as Record<string, unknown>
    parts.push(
      Object.entries(after)
        .map(([k, v]) => `${k} → ${v === null ? 'par défaut' : String(v)}`)
        .join(', '),
    )
  }
  if (Array.isArray(details.fields) && details.fields.length) parts.push(`champs : ${details.fields.join(', ')}`)
  return parts.join(' · ')
}
