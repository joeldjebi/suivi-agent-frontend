import lottie from 'lottie-web/build/player/lottie_light'
import { useEffect, useRef } from 'react'

/** Lecteur Lottie (SVG) en boucle ; recréé quand l'animation change. */
export function LottiePlayer({ data, className }: { data: object; className?: string }) {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!container.current) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const player = lottie.loadAnimation({
      container: container.current,
      renderer: 'svg',
      loop: !reduce,
      autoplay: !reduce,
      animationData: data,
    })
    // Mouvements réduits : image finale, sans animation.
    if (reduce) player.addEventListener('DOMLoaded', () => player.goToAndStop(player.totalFrames - 1, true))
    return () => player.destroy()
  }, [data])
  return <div ref={container} className={className} aria-hidden />
}
