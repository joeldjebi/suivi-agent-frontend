import { ClipboardCheck, Radio, Target } from 'lucide-react'
import { LogoMark } from '@/components/app/logo'
import type { ReactNode } from 'react'

const FEATURES = [
  { icon: Radio, title: 'Positions en temps réel', text: 'Chaque agent en journée apparaît sur la carte, même hors connexion.' },
  { icon: ClipboardCheck, title: 'Zones et places maîtrisées', text: 'Capacité par zone, approbation automatique, manuelle ou mixte.' },
  { icon: Target, title: 'Missions mesurables', text: 'Objectifs chiffrés et formulaires adaptés à votre activité.' },
]

/** Écran d'authentification : panneau de marque à gauche (grand écran), formulaire à droite. */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside
        aria-hidden
        className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12"
      >
        {/* Trame de carte : quadrillage et zones stylisées */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(rgb(255 255 255 / .25) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / .25) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="pointer-events-none absolute -top-10 -right-24 size-64 rotate-12 rounded-3xl border-2 border-white/40 bg-white/5" />
        <div className="pointer-events-none absolute right-40 bottom-28 size-40 rounded-2xl border-2 border-dashed border-white/40 -rotate-6" />
        <span className="pointer-events-none absolute top-24 right-16 size-4 rounded-full bg-white shadow-[0_0_0_6px_rgb(255_255_255/.25)]" />
        <span className="pointer-events-none absolute right-64 bottom-44 size-3 rounded-full bg-white/90 shadow-[0_0_0_5px_rgb(255_255_255/.2)]" />

        <div className="relative flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white text-primary">
            <LogoMark className="size-6" hole="#ffffff" />
          </span>
          <span className="text-lg font-semibold">Suivi Agent</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight font-semibold text-balance">Vos équipes terrain, en temps réel, sur une seule carte.</h2>
          <ul className="mt-8 flex flex-col gap-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <f.icon className="size-4.5" />
                </span>
                <span>
                  <span className="block font-medium">{f.title}</span>
                  <span className="text-sm text-white/80">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/70">
          Les données de chaque structure sont isolées. Le suivi se limite à la journée de travail.
        </p>
      </aside>

      <main className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:hidden">
              <LogoMark className="size-6" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          {children}
          {footer && <p className="mt-6 text-sm text-muted-foreground">{footer}</p>}
        </div>
      </main>
    </div>
  )
}
