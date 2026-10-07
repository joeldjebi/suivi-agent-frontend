const LOCALE = 'fr-FR'

export function formatDateTime(value: string | Date | null | undefined, timeZone?: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short', timeStyle: 'short', timeZone }).format(new Date(value))
}

export function formatTime(value: string | Date | null | undefined, timeZone?: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(LOCALE, { timeStyle: 'short', timeZone }).format(new Date(value))
}

export function formatDate(value: string | Date | null | undefined, timeZone?: string): string {
  if (!value) return '—'
  // Une date de travail AAAA-MM-JJ est affichée telle quelle, sans décalage horaire.
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value)
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeZone: timeZone ?? 'UTC' }).format(date)
}

/** « il y a 3 min », « dans 12 min » */
export function formatRelative(value: string | Date | null | undefined, now = Date.now()): string {
  if (!value) return '—'
  const seconds = Math.round((new Date(value).getTime() - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })
  const abs = Math.abs(seconds)
  if (abs < 60) return rtf.format(seconds, 'second')
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  return rtf.format(Math.round(seconds / 86400), 'day')
}

/** 3725 → « 1 h 02 » */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours === 0) return `${minutes} min`
  return `${hours} h ${String(minutes).padStart(2, '0')}`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 }).format(value)
}

export function fullName(user: { firstName: string; lastName: string } | null | undefined): string {
  return user ? `${user.firstName} ${user.lastName}` : '—'
}

export function initials(user: { firstName: string; lastName: string }): string {
  return `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
}

/** « 07 01 01 01 01 » pour un numéro ivoirien (+225), sinon le numéro tel quel. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  if (!phone.startsWith('+225')) return phone
  const local = phone.slice(4)
  return (local.match(/.{1,2}/g) ?? [local]).join(' ')
}

/** Date du jour (ou d'un instant) au format des champs date : AAAA-MM-JJ, heure locale. */
export function dateInput(at: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

/** Échéance saisie : fin de journée locale. */
export const dueFromInput = (value: string) => new Date(`${value}T23:59:00`).toISOString()

/** Durée de travail : 480 → « 8 h », 450 → « 7 h 30 », 30 → « 30 min ». */
export function formatWorkday(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}
