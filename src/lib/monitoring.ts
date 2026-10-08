import { api, session } from './api'

/**
 * Erreurs du site : remontées au journal de la console éditeur (toujours) et à Sentry (si
 * VITE_SENTRY_DSN est renseigné, chargé à la demande). Rien de personnel ne part : ni
 * contenu des pages, ni jeton, ni saisie.
 */
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

type SentryModule = typeof import('@sentry/react')
let sentry: Promise<SentryModule> | null = null

/** Au plus 10 erreurs différentes par page ouverte (une boucle d'erreurs ne noie pas le journal). */
const reported = new Set<string>()

export function initMonitoring() {
  window.addEventListener('error', (event) => reportError(event.error ?? event.message))
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason))
  if (!dsn) return
  sentry = import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0,
      beforeBreadcrumb: (crumb) => (crumb.category === 'ui.input' ? null : crumb),
      beforeSend(event) {
        if (event.request?.headers) delete event.request.headers.Authorization
        return event
      },
    })
    return Sentry
  })
}

/** Erreur d'affichage ou inattendue : journal de l'éditeur, et Sentry s'il est actif. */
export function reportError(error: unknown) {
  void sentry?.then((Sentry) => Sentry.captureException(error))
  // Requêtes refusées (réseau, droits) : déjà affichées à l'utilisateur, pas des bugs.
  if (error && typeof error === 'object' && 'isAxiosError' in error) return
  const message = error instanceof Error ? error.message : String(error ?? 'Erreur inconnue')
  if (reported.has(message) || reported.size >= 10) return
  reported.add(message)
  // Connecté à une structure seulement (la console éditeur a son propre accès).
  if (!session.accessToken) return
  void api
    .post('/client-errors', {
      source: 'web',
      message: message.slice(0, 2000),
      stack: error instanceof Error ? error.stack?.slice(0, 8000) : undefined,
      route: window.location.pathname.replace(/[0-9a-f-]{36}/gi, ':id').slice(0, 300),
    })
    .catch(() => undefined)
}
