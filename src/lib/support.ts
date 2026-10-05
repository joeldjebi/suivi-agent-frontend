import { SupportCategory, SupportStatus } from '@suivi/shared'

export const supportCategoryLabel: Record<SupportCategory, string> = {
  [SupportCategory.Question]: 'Question',
  [SupportCategory.Bug]: 'Problème',
  [SupportCategory.Billing]: 'Facturation',
  [SupportCategory.Account]: 'Compte et accès',
  [SupportCategory.Feature]: 'Suggestion',
  [SupportCategory.Other]: 'Autre',
}

export const supportStatusLabel: Record<SupportStatus, string> = {
  [SupportStatus.Open]: 'En attente du support',
  [SupportStatus.Answered]: 'Réponse reçue',
  [SupportStatus.Closed]: 'Fermée',
}
