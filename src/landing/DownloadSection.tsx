import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { ArrowRight, Download, Globe } from 'lucide-react'
import type { ReactNode } from 'react'

/** Fichier d'installation Android publié avec le site. */
const APK = '/downloads/performx.apk'

interface AppVersion {
  latestVersion: string | null
  androidUrl: string | null
}

/** Version web des agents et chefs (app.performx.online), déduite du domaine du site. */
const webAppUrl = () => {
  const { protocol, hostname } = window.location
  return hostname === 'localhost' || /^\d/.test(hostname)
    ? 'https://app.performx.online'
    : `${protocol}//app.${hostname.replace(/^www\./, '')}`
}

/**
 * Téléchargement de l'app pour les agents et chefs d'équipe : Android par le fichier APK
 * (celui réglé dans la console s'il s'agit d'un APK), iPhone par la version web installable.
 */
export function DownloadSection() {
  const query = useQuery({
    queryKey: ['public', 'app-version'],
    queryFn: async () => (await axios.get<AppVersion>('/api/app/version')).data,
    retry: false,
    staleTime: 5 * 60_000,
  })
  const configured = query.data?.androidUrl
  const android = configured && /\.apk(\?|$)/i.test(configured) ? configured : APK
  const version = query.data?.latestVersion

  return (
    <section id="telecharger" className="bg-[#f5f5f7] px-5 py-24 @3xl:py-32">
      <div className="mx-auto max-w-[980px]">
        <div className="text-center">
          <p className="text-[17px] font-semibold text-[#0071e3]">L’app des équipes terrain</p>
          <h2 className="mt-2 text-[40px] leading-[1.06] font-semibold tracking-[-0.025em] @3xl:text-[56px]">Téléchargez PerformX.</h2>
          <p className="mx-auto mt-4 max-w-[560px] text-[19px] text-[#6e6e73]">
            Pour vos agents et vos chefs d’équipe. Ils se connectent avec le numéro et le mot de passe donnés par leur responsable.
          </p>
        </div>

        <div className="mt-14 grid gap-5 @3xl:grid-cols-2">
          <Platform
            icon={<AndroidMark />}
            title="Android"
            subtitle={version ? `Version ${version}` : 'Téléphones Android'}
            href={android}
            download
            action="Télécharger pour Android"
            actionIcon={<Download className="size-4" aria-hidden />}
          >
            <li>Touchez « Télécharger pour Android », puis ouvrez le fichier.</li>
            <li>Si le téléphone le demande, autorisez l’installation depuis le navigateur.</li>
            <li>Touchez « Installer », puis ouvrez PerformX.</li>
          </Platform>
          <Platform
            icon={<AppleMark />}
            title="iPhone"
            subtitle="Version web, dans Safari"
            href={webAppUrl()}
            action="Ouvrir l’app web"
            actionIcon={<Globe className="size-4" aria-hidden />}
          >
            <li>Ouvrez le lien dans Safari et connectez-vous.</li>
            <li>
              Touchez <span className="font-medium text-[#1d1d1f]">Partager</span>, puis{' '}
              <span className="font-medium text-[#1d1d1f]">« Sur l’écran d’accueil »</span>.
            </li>
            <li>PerformX s’ouvre ensuite comme une app, depuis son icône.</li>
          </Platform>
        </div>

        <p className="mt-8 text-center text-[14px] text-[#6e6e73]">
          <a href="/telecharger" className="inline-flex items-center gap-1 text-[#0066cc] hover:underline">
            Toutes les options de téléchargement <ArrowRight className="size-3.5" aria-hidden />
          </a>
        </p>
      </div>
    </section>
  )
}

function Platform({
  icon,
  title,
  subtitle,
  href,
  download,
  action,
  actionIcon,
  children,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  href: string
  download?: boolean
  action: string
  actionIcon: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col rounded-[28px] bg-white p-7 shadow-[0_2px_12px_rgba(0,0,0,0.04)] @3xl:p-9">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-[#f5f5f7]">{icon}</span>
        <div>
          <h3 className="text-[24px] font-semibold tracking-tight">{title}</h3>
          <p className="text-[14px] text-[#6e6e73]">{subtitle}</p>
        </div>
      </div>
      <ol className="mt-6 flex-1 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-[#6e6e73]">{children}</ol>
      <a
        href={href}
        {...(download ? { download: 'PerformX.apk' } : { target: '_blank', rel: 'noopener noreferrer' })}
        className="mt-7 inline-flex h-12 items-center justify-center gap-2 self-start rounded-full bg-[#0071e3] px-6 text-[17px] font-medium text-white transition-colors hover:bg-[#0077ed] focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {actionIcon}
        {action}
      </a>
    </div>
  )
}

/** Silhouette du robot Android (marque d'usage courant pour désigner la plateforme). */
function AndroidMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" aria-hidden>
      <path
        fill="#3ddc84"
        d="M17.6 9.48l1.84-3.18a.38.38 0 0 0-.66-.38l-1.86 3.22a11.5 11.5 0 0 0-9.84 0L5.22 5.92a.38.38 0 0 0-.66.38L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z"
      />
    </svg>
  )
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" aria-hidden>
      <path
        fill="#1d1d1f"
        d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.32-3.52zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.69-.92 2.68.97.08 1.96-.49 2.56-1.23z"
      />
    </svg>
  )
}
