import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Component, lazy, type ComponentType, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

const RELOAD_KEY = 'suivi.chunkReload'

/**
 * Chargement d'un écran à la demande. Si son fichier n'existe plus (nouvelle version
 * déployée, cache de développement périmé), la page est rechargée une seule fois.
 */
export function lazyPage<T extends ComponentType>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const module = await load()
      try {
        sessionStorage.removeItem(RELOAD_KEY)
      } catch {
        // stockage indisponible
      }
      return module
    } catch (error) {
      let alreadyReloaded = false
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_KEY) === '1'
        if (!alreadyReloaded) sessionStorage.setItem(RELOAD_KEY, '1')
      } catch {
        alreadyReloaded = true
      }
      if (!alreadyReloaded) {
        window.location.reload()
        // La page se recharge : on attend sans rien afficher d'autre.
        return new Promise<never>(() => undefined)
      }
      throw error
    }
  })
}

/** Affiche une erreur lisible au lieu d'une page blanche si un écran ne peut pas s'afficher. */
/** À monter avec `key={pathname}` : changer de page repart d'un état sans erreur. */
export class RouteErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Erreur d’affichage', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    const chunk = /dynamically imported module|Importing a module script failed|Loading chunk/i.test(this.state.error.message)
    return (
      <div role="alert" className="flex h-full min-h-80 flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="size-8 text-status-paused" aria-hidden />
        <p className="font-medium">{chunk ? 'Cette page n’a pas pu être chargée' : 'Cette page a rencontré un problème'}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {chunk
            ? 'Une nouvelle version de l’application est peut-être disponible. Rechargez pour continuer.'
            : 'Rechargez la page. Si le problème persiste, contactez le support.'}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            try {
              sessionStorage.removeItem(RELOAD_KEY)
            } catch {
              // stockage indisponible
            }
            window.location.reload()
          }}
        >
          <RefreshCw aria-hidden /> Recharger
        </Button>
      </div>
    )
  }
}
