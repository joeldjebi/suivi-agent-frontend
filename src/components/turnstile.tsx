import { useEffect, useRef } from 'react'

/** Clé publique du widget Turnstile (CAPTCHA Cloudflare). Sans elle, pas de widget. */
export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || ''
/** La protection anti-robot n'est active que si la clé publique est configurée. */
export const TURNSTILE_ENABLED = !!TURNSTILE_SITE_KEY

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string
  remove(id: string): void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<void> | null = null
/** Charge le script Cloudflare une seule fois pour toute la page. */
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => {
      scriptPromise = null
      reject(new Error('Chargement du CAPTCHA impossible'))
    }
    document.head.appendChild(s)
  })
  return scriptPromise
}

/**
 * Widget anti-robot Turnstile. Appelle `onToken` avec le jeton quand l'utilisateur est
 * validé, et avec `null` quand le jeton expire ou échoue (le parent redemande alors une
 * validation avant d'envoyer). Ne s'affiche pas si la clé publique n'est pas configurée.
 */
export function Turnstile({ onToken, className }: { onToken: (token: string | null) => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  // Le callback peut changer à chaque rendu : on garde le dernier sans réinitialiser le widget.
  const cb = useRef(onToken)
  useEffect(() => {
    cb.current = onToken
  }, [onToken])

  useEffect(() => {
    if (!TURNSTILE_ENABLED) return
    let widgetId: string | null = null
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return
        widgetId = window.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'auto',
          callback: (token: string) => cb.current(token),
          'expired-callback': () => cb.current(null),
          'error-callback': () => cb.current(null),
        })
      })
      .catch(() => cb.current(null))
    return () => {
      cancelled = true
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [])

  if (!TURNSTILE_ENABLED) return null
  return <div ref={ref} className={className} />
}
