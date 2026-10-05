import type { LeadStats } from '@/lib/types'

/** « 8 min », « 1 h 05 » */
export function formatResponse(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

/** Réactivité : rapide sous 15 min, correcte sous 45 min, lente au-delà. */
export function responseTone(seconds: number | null): string {
  if (seconds === null) return 'text-muted-foreground'
  if (seconds < 15 * 60) return 'text-status-active'
  if (seconds < 45 * 60) return 'text-status-paused'
  return 'text-status-alert'
}

/** Jours depuis la dernière connexion (null : jamais). */
export function daysSince(value: string | null): number | null {
  if (!value) return null
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400_000)
}

/** Au-delà, le chef est signalé comme absent. */
export const ABSENT_DAYS = 3

/** Points d'attention d'un chef sur la période. */
export function leadAlerts(l: LeadStats): string[] {
  const alerts: string[] = []
  const absent = daysSince(l.lastLoginAt)
  if (l.requestsUnanswered > 0) alerts.push(`${l.requestsUnanswered} demande${l.requestsUnanswered > 1 ? 's' : ''} sans réponse`)
  if (absent === null) alerts.push('Jamais connecté')
  else if (absent >= ABSENT_DAYS) alerts.push(`Pas connecté depuis ${absent} jours`)
  if (l.groups.length === 0) alerts.push('Aucun groupe')
  if (!l.isActive) alerts.push('Compte désactivé')
  return alerts
}
