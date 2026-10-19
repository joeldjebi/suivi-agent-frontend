import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Globe, Smartphone } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'

interface AppVersion {
  latestVersion: string | null
  androidUrl: string | null
  iosUrl: string | null
}

/** Adresse de la version web (app.performx.online), déduite du domaine du site. */
const webAppUrl = () => {
  const { protocol, hostname } = window.location
  return hostname === 'localhost' || /^\d/.test(hostname) ? null : `${protocol}//app.${hostname.replace(/^www\./, '')}`
}

/**
 * Téléchargement de l'app pour les agents et chefs : Android (Play Store ou fichier APK),
 * iPhone (App Store ou TestFlight), et version web. Liens réglés dans la console éditeur.
 */
export function DownloadPage() {
  const query = useQuery({
    queryKey: ['public', 'app-version'],
    queryFn: async () => (await axios.get<AppVersion>('/api/app/version')).data,
    retry: false,
  })
  useEffect(() => {
    const previous = document.title
    document.title = 'Télécharger PerformX'
    return () => {
      document.title = previous
    }
  }, [])
  const android = query.data?.androidUrl ?? null
  const ios = query.data?.iosUrl ?? null
  const apk = !!android && /\.apk(\?|$)/i.test(android)
  const testflight = !!ios && /testflight\.apple\.com/i.test(ios)
  const web = webAppUrl()

  return (
    <div className="min-h-svh bg-[#f5f5f7] text-[#1d1d1f]">
      <header className="border-b border-black/10 bg-white px-5 py-4">
        <div className="mx-auto max-w-[760px]">
          <Link to="/" className="text-[15px] font-semibold tracking-tight">
            PerformX
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-[760px] flex-col gap-5 px-5 py-10">
        <div>
          <h1 className="text-[32px] leading-tight font-semibold tracking-tight">Télécharger l’app</h1>
          <p className="mt-2 text-[15px] text-[#424245]">
            Pour les agents et chefs d’équipe. Connectez-vous ensuite avec le numéro et le mot de passe fournis par votre structure.
            {query.data?.latestVersion ? ` Version ${query.data.latestVersion}.` : ''}
          </p>
        </div>

        <Platform
          icon={<Smartphone className="size-6" aria-hidden />}
          title="Android"
          href={android}
          action={apk ? 'Télécharger le fichier d’installation' : 'Ouvrir Google Play'}
        >
          {apk && (
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-[14px] text-[#424245]">
              <li>Touchez le bouton, puis ouvrez le fichier téléchargé.</li>
              <li>Si le téléphone le demande, autorisez l’installation depuis votre navigateur (« sources inconnues »).</li>
              <li>Touchez « Installer », puis ouvrez PerformX.</li>
            </ol>
          )}
        </Platform>

        <Platform
          icon={<Smartphone className="size-6" aria-hidden />}
          title="iPhone"
          href={ios}
          action={testflight ? 'Rejoindre le test sur TestFlight' : 'Ouvrir l’App Store'}
        >
          {testflight && (
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-[14px] text-[#424245]">
              <li>Installez d’abord l’app « TestFlight » d’Apple depuis l’App Store.</li>
              <li>Revenez ici, touchez le bouton, puis « Accepter » et « Installer ».</li>
            </ol>
          )}
        </Platform>

        {web && (
          <Platform icon={<Globe className="size-6" aria-hidden />} title="Version web" href={web} action="Ouvrir la version web">
            <p className="mt-3 text-[14px] text-[#424245]">
              Dans le navigateur, sur téléphone ou ordinateur. Le suivi de la journée ne fonctionne que page ouverte : pour un suivi
              continu, utilisez l’app mobile.
            </p>
          </Platform>
        )}
      </main>
    </div>
  )
}

function Platform({
  icon,
  title,
  href,
  action,
  children,
}: {
  icon: ReactNode
  title: string
  href: string | null
  action: string
  children?: ReactNode
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-[#2563eb]/10 text-[#2563eb]">{icon}</span>
        <h2 className="text-[20px] font-semibold">{title}</h2>
      </div>
      {href ? (
        <>
          <a
            href={href}
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#2563eb] px-5 text-[15px] font-medium text-white hover:bg-[#1d4ed8] focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {action}
          </a>
          {children}
        </>
      ) : (
        <p className="mt-3 text-[14px] text-[#6e6e73]">Bientôt disponible.</p>
      )}
    </section>
  )
}
