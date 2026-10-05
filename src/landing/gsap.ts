import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useContext, useLayoutEffect, type DependencyList, type RefObject } from 'react'
import { ScrollRootContext, useReducedMotion } from './motion'

gsap.registerPlugin(ScrollTrigger)

export { gsap, ScrollTrigger }

/**
 * Animations GSAP d'une section, nettoyées au démontage. Le défilement suivi est la fenêtre
 * (site) ou le cadre d'aperçu (console). Avec « réduire les animations », rien n'est animé :
 * chaque section s'affiche dans son état final.
 */
export function useScrollScene(
  scope: RefObject<HTMLElement | null>,
  build: (ctx: { scroller: Element | Window; reduced: boolean }) => void,
  deps: DependencyList = [],
) {
  const root = useContext(ScrollRootContext)
  const reduced = useReducedMotion()
  useLayoutEffect(() => {
    if (!scope.current) return
    const scroller = root?.current ?? window
    const ctx = gsap.context(() => build({ scroller, reduced }), scope)
    // Polices et images chargées : positions recalculées.
    const refresh = () => ScrollTrigger.refresh()
    document.fonts?.ready.then(refresh).catch(() => undefined)
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, reduced, ...deps])
}
