/**
 * Supervision des erreurs du site (Sentry) : chargée seulement si VITE_SENTRY_DSN est
 * renseigné. Rien de personnel ne part : ni contenu des pages, ni jeton, ni saisie.
 */
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

type SentryModule = typeof import('@sentry/react')
let sentry: Promise<SentryModule> | null = null

export function initMonitoring() {
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

/** Erreur d'affichage d'un écran : envoyée à la supervision si elle est active. */
export function reportError(error: unknown) {
  void sentry?.then((Sentry) => Sentry.captureException(error))
}
