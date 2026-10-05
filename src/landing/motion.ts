import { createContext, useContext, useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Élément qui défile : la fenêtre pour le site, le cadre d'aperçu dans la console.
 * Les animations liées au défilement l'écoutent.
 */
export const ScrollRootContext = createContext<RefObject<HTMLElement | null> | null>(null)

function scrollTarget(root: RefObject<HTMLElement | null> | null): HTMLElement | Window {
  return root?.current ?? window
}

/** Réglage « réduire les animations » du système. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      return false
    }
  })
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** Vrai dès que l'élément entre dans la zone visible (une seule fois). */
export function useInView<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null)
  // Navigateur sans IntersectionObserver : tout est visible d'emblée.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, visible])
  return [ref, visible] as const
}

/**
 * Avancement du défilement à travers l'élément, de 0 (son haut atteint le bas de l'écran)
 * à 1 (son bas atteint le haut). Calcul à chaque image, sans re-rendu inutile.
 */
export function useScrollProgress<T extends HTMLElement>(mode: 'through' | 'pinned' = 'through') {
  const ref = useRef<T>(null)
  const root = useContext(ScrollRootContext)
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const target = scrollTarget(root)
    let frame = 0
    const measure = () => {
      frame = 0
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const container = root?.current
      const top = container ? rect.top - container.getBoundingClientRect().top : rect.top
      const viewport = container ? container.clientHeight : window.innerHeight
      const value =
        mode === 'pinned'
          ? // Section collante : de son arrivée en haut à la fin de sa hauteur.
            -top / Math.max(1, rect.height - viewport)
          : (viewport - top) / (viewport + rect.height)
      const clamped = Math.min(1, Math.max(0, value))
      setProgress((p) => (Math.abs(p - clamped) > 0.002 ? clamped : p))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    target.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      target.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [root, mode])
  return [ref, progress] as const
}

/** Nombre qui défile de 0 à sa valeur quand il devient visible (« 30 s », « 100 % »…). */
export function useCountUp(value: string, active: boolean, reduced: boolean): string {
  const match = /^(\D*)(\d+(?:[.,]\d+)?)(.*)$/.exec(value)
  const target = match ? Number(match[2].replace(',', '.')) : 0
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    if (!active || !match || reduced) return
    const start = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / 1200)
      setCurrent(target * (1 - Math.pow(1 - t, 3)))
      if (t < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, target, reduced])
  if (!match) return value
  if (reduced || !active) return reduced ? value : `${match[1]}0${match[3]}`
  const decimals = match[2].includes(',') || match[2].includes('.') ? 1 : 0
  return `${match[1]}${current.toFixed(decimals).replace('.', ',')}${match[3]}`
}

/** Valeur interpolée entre a et b selon t (0..1), bornée. */
export const mix = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t))
