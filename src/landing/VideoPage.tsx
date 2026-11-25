import { MapPin, ClipboardCheck, BarChart3 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

/** Téléphone (écran étroit) : on sert la vidéo verticale, plein cadre et immersive. */
const PORTRAIT_QUERY = '(max-width: 640px)'

/**
 * Suit le temps réellement regardé et le % atteint, et remonte au serveur (anonyme, ou lié à
 * un prospect si le lien est …/video?p=<id>). Envois périodiques + à la fermeture (sendBeacon).
 */
function useVideoTracking(portrait: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const st = useRef({ viewId: '', prospectId: null as string | null, seconds: 0, percent: 0, duration: 0, last: 0, sent: 0 })

  useEffect(() => {
    const s = st.current
    if (s.viewId) return
    s.viewId = globalThis.crypto?.randomUUID?.() ?? `v-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const p = new URLSearchParams(window.location.search).get('p')
    s.prospectId = p && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(p) ? p : null
  }, [])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    const s = st.current
    const send = (beacon = false) => {
      s.sent = s.seconds
      const body = JSON.stringify({
        viewId: s.viewId,
        prospectId: s.prospectId ?? undefined,
        seconds: Math.round(s.seconds),
        percent: Math.round(s.percent),
        duration: s.duration || undefined,
        orientation: portrait ? 'portrait' : 'landscape',
      })
      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon('/api/public/video/view', new Blob([body], { type: 'application/json' }))
      } else {
        fetch('/api/public/video/view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
      }
    }
    const onMeta = () => { s.duration = Math.round(el.duration || 0); s.last = el.currentTime }
    const onTime = () => {
      const d = el.currentTime - s.last
      s.last = el.currentTime
      if (d > 0 && d < 1.5) s.seconds += d
      if (el.duration) s.percent = Math.max(s.percent, (el.currentTime / el.duration) * 100)
      if (s.seconds - s.sent >= 10) send()
    }
    const onPlay = () => { s.last = el.currentTime; send() }
    const onPause = () => send()
    const onEnded = () => { s.percent = 100; send() }
    const onHide = () => { if (document.visibilityState === 'hidden') send(true) }
    const onPageHide = () => send(true)

    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
      if (s.seconds > s.sent) send(true)
    }
  }, [portrait])

  return videoRef
}

function usePortrait() {
  const [portrait, setPortrait] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(PORTRAIT_QUERY).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(PORTRAIT_QUERY)
    const update = () => setPortrait(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return portrait
}

/**
 * Page vidéo publique : une présentation de PerformX en une minute, à envoyer aux
 * prospects (lien partageable /video). Vidéos servies en fichiers statiques (public/media/ —
 * un dossier distinct de la route, sinon Nginx redirige /video vers /video/ et renvoie 403).
 * Sur téléphone, la version verticale ; sur ordinateur, la version horizontale.
 */
export function VideoPage() {
  const portrait = usePortrait()
  const videoRef = useVideoTracking(portrait)
  const video = portrait
    ? { src: '/media/performx-presentation-vertical.mp4', poster: '/media/performx-poster-vertical.jpg' }
    : { src: '/media/performx-presentation.mp4', poster: '/media/performx-poster.jpg' }

  useEffect(() => {
    const previous = document.title
    document.title = 'PerformX en vidéo'
    return () => {
      document.title = previous
    }
  }, [])

  return (
    <div className="min-h-svh bg-[#f5f5f7] text-[#1d1d1f]">
      <header className="border-b border-black/10 bg-white px-5 py-4">
        <div className="mx-auto max-w-[860px]">
          <Link to="/" className="text-[15px] font-semibold tracking-tight">
            PerformX
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-[860px] flex-col gap-8 px-5 py-10 sm:py-14">
        <div className="text-center">
          <p className="text-[13px] font-medium tracking-wide text-[#2563eb] uppercase">Présentation</p>
          <h1 className="mt-2 text-[32px] leading-tight font-semibold tracking-tight sm:text-[40px]">
            PerformX en une minute
          </h1>
          <p className="mx-auto mt-3 max-w-[560px] text-[16px] text-[#424245]">
            Le suivi de vos équipes de terrain en temps réel : géolocalisation des agents, visites
            clients, missions avec preuves, et tableaux de bord pour les responsables.
          </p>
        </div>

        <div
          className={`mx-auto w-full overflow-hidden rounded-2xl bg-black shadow-[0_8px_30px_rgba(0,0,0,0.12)] ${
            portrait ? 'max-w-[320px]' : ''
          }`}
        >
          <video
            key={video.src}
            ref={videoRef}
            className={`w-full ${portrait ? 'aspect-[9/16]' : 'aspect-video'}`}
            controls
            playsInline
            preload="metadata"
            poster={video.poster}
          >
            <source src={video.src} type="video/mp4" />
            Votre navigateur ne peut pas lire cette vidéo.{' '}
            <a href={video.src} className="underline">
              Télécharger la vidéo
            </a>
            .
          </video>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Feature
            icon={<MapPin className="size-6" aria-hidden />}
            title="Suivi en temps réel"
            text="Où sont les agents, leurs tournées et leur présence sur le terrain, en direct."
          />
          <Feature
            icon={<ClipboardCheck className="size-6" aria-hidden />}
            title="Missions & visites"
            text="Visites de points de vente et missions, avec photos et position comme preuves."
          />
          <Feature
            icon={<BarChart3 className="size-6" aria-hidden />}
            title="Tableaux de bord"
            text="Statistiques et rapports clairs pour piloter les équipes depuis un ordinateur."
          />
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#2563eb] px-6 text-[15px] font-medium text-white hover:bg-[#1d4ed8] focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Découvrir PerformX
          </Link>
          <Link
            to="/telecharger"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/15 bg-white px-6 text-[15px] font-medium text-[#1d1d1f] hover:bg-black/[0.03] focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Télécharger l’app
          </Link>
        </div>
      </main>

      <footer className="px-5 pb-10 text-center text-[13px] text-[#6e6e73]">
        PerformX — suivi des équipes de terrain
      </footer>
    </div>
  )
}

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <span className="flex size-11 items-center justify-center rounded-xl bg-[#2563eb]/10 text-[#2563eb]">{icon}</span>
      <h2 className="mt-3 text-[16px] font-semibold">{title}</h2>
      <p className="mt-1 text-[14px] text-[#424245]">{text}</p>
    </section>
  )
}
