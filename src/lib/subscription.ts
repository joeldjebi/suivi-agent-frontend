import { Feature, SubscriptionStatus } from '@suivi/shared'
import { useMe } from './auth'

/** Noms des formules installées ; les formules créées par l'éditeur portent leur propre nom. */
export const planLabel: Record<string, string> = {
  base: 'Base',
  advanced: 'Avancée',
  enterprise: 'Entreprise',
}

export const subscriptionStatusLabel: Record<SubscriptionStatus, string> = {
  trialing: 'Essai gratuit',
  active: 'Actif',
  past_due: 'Paiement en retard',
  suspended: 'Suspendu',
  cancelled: 'Résilié',
}

export const featureLabel: Record<Feature, string> = {
  groups: 'Groupes et chefs d’équipe',
  manual_approval: 'Validation des zones (manuelle ou mixte)',
  missions: 'Missions et formulaires',
  branding: 'App mobile aux couleurs de la structure',
  exports: 'Exports CSV',
  stats: 'Statistiques détaillées',
  team_leads: 'Suivi des chefs d’équipe',
  audit: 'Journal d’accès',
  payroll: 'Rémunération des agents et chefs',
  push_notifications: 'Notifications push sur les téléphones',
}

/** Inclus dans toutes les formules. */
export const BASE_FEATURES = [
  'Suivi en temps réel sur la carte',
  'Zones, demandes de zone et journées de travail',
  'Historique et itinéraires',
  'App mobile pour les agents',
]

/** Vrai si la fonctionnalité est ouverte pour la structure (essai inclus). */
export function useFeature(feature: Feature): boolean {
  return useMe().subscription.features.includes(feature)
}

/** Nom d'une formule à partir de son code (repli pour les formules créées par l'éditeur). */
export function planName(code: string): string {
  return planLabel[code] ?? code
}

export function formatMoney(amount: number, currency = 'XOF'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}
