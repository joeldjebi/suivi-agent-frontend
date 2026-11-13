import { MapPin, ClipboardCheck, BarChart3 } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'

/**
 * Page vidéo publique : une présentation de PerformX en une minute, à envoyer aux
 * prospects (lien partageable /video). Vidéo servie en fichier statique (public/media/ —
 * un dossier distinct de la route, sinon Nginx redirige /video vers /video/ et renvoie 403).
 */
export function VideoPage() {
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

        <div className="overflow-hidden rounded-2xl bg-black shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <video
            className="aspect-video w-full"
            controls
            playsInline
            preload="metadata"
            poster="/media/performx-poster.jpg"
          >
            <source src="/media/performx-presentation.mp4" type="video/mp4" />
            Votre navigateur ne peut pas lire cette vidéo.{' '}
            <a href="/media/performx-presentation.mp4" className="underline">
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
