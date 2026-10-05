import type { LandingCta, PublicLanding } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import Lenis from 'lenis'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/lib/auth'
import { DemoDialog } from './DemoDialog'
import { gsap, ScrollTrigger } from './gsap'
import { Landing } from './Landing'
import { useReducedMotion } from './motion'

/** Titre et description de la page pour les moteurs de recherche et le partage. */
function useSeo(data: PublicLanding | undefined) {
  useEffect(() => {
    if (!data) return
    const previous = document.title
    document.title = data.content.seo.title
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const created = !meta
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.append(meta)
    }
    meta.content = data.content.seo.description
    return () => {
      document.title = previous
      if (created) meta?.remove()
    }
  }, [data])
}

/** Défilement amorti (inertie douce), synchronisé avec les animations GSAP. */
function useSmoothScroll(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) })
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    // Les ancres du menu défilent en douceur.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]')
      if (!link) return
      const target = document.querySelector(link.getAttribute('href')!)
      if (!target) return
      e.preventDefault()
      lenis.scrollTo(target as HTMLElement, { offset: -48 })
    }
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('click', onClick)
      gsap.ticker.remove(tick)
      lenis.destroy()
    }
  }, [enabled])
}

/** Site vitrine public, à la racine du site. */
export function LandingPage() {
  const navigate = useNavigate()
  const { me } = useAuth()
  const reduced = useReducedMotion()
  const [demo, setDemo] = useState(false)
  const query = useQuery({
    queryKey: ['public', 'landing'],
    queryFn: async () => (await axios.get<PublicLanding>('/api/public/landing')).data,
    staleTime: 60_000,
  })
  useSeo(query.data)
  useSmoothScroll(!!query.data && !reduced)

  const onAction = (cta: LandingCta) => {
    if (cta.action === 'demo') setDemo(true)
    else if (cta.action === 'signup') navigate(me ? '/map' : '/register')
    else if (cta.action === 'login') navigate(me ? '/map' : '/login')
    else if (cta.href) {
      if (cta.href.startsWith('#')) document.querySelector(cta.href)?.scrollIntoView({ behavior: 'smooth' })
      else if (cta.href.startsWith('/')) navigate(cta.href)
      else window.open(cta.href, '_blank', 'noopener')
    }
  }

  if (!query.data)
    return (
      <div className="flex h-dvh items-center justify-center bg-white" role="status" aria-label="Chargement">
        {query.isError ? (
          <p className="text-sm text-neutral-500">Le site est momentanément indisponible. Réessayez dans un instant.</p>
        ) : (
          <Loader2 className="size-6 animate-spin text-neutral-400" aria-hidden />
        )}
      </div>
    )
  return (
    <>
      <Landing data={query.data} onAction={onAction} signedIn={!!me} />
      <DemoDialog open={demo} onClose={() => setDemo(false)} />
    </>
  )
}
