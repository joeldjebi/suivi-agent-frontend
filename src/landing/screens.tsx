import {
  BarChart3,
  Bell,
  Check,
  ClipboardCheck,
  Clock,
  History,
  MapPinned,
  Pause,
  Square,
  Target,
  Users,
  UsersRound,
  Wallet,
  WifiOff,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { StatusBar } from './devices'
import { LiveMap } from './live-map'
import { useReducedMotion } from './motion'

/**
 * Écrans du produit, tels qu'ils apparaissent dans les appareils. Tailles exprimées en
 * unités de conteneur (cqw) : l'écran garde ses proportions quelle que soit la taille.
 */

// ------------------------------------------------------------ app web (MacBook)

const NAV = [
  [MapPinned, 'Carte en temps réel', true],
  [BarChart3, 'Statistiques', false],
  [ClipboardCheck, 'Demandes de zone', false],
  [History, 'Historique', false],
  [Target, 'Missions', false],
  [UsersRound, 'Groupes', false],
  [Users, 'Utilisateurs', false],
  [Wallet, 'Rémunération', false],
] as const

const PEOPLE = [
  ['KB', 'Koffi Brou', 'Plateau', 'En journée', 'bg-emerald-500'],
  ['AD', 'Aminata Diallo', 'Plateau', 'En journée', 'bg-emerald-500'],
  ['AB', 'Awa Bamba', 'Hors zone', 'Alerte', 'bg-rose-500'],
  ['SG', 'Serge Gbagbo', 'Cocody', 'En journée', 'bg-emerald-500'],
  ['MT', 'Mariam Traoré', 'Treichville', 'Pause', 'bg-amber-500'],
  ['JA', 'Jean-Marc Aka', 'Cocody', 'En journée', 'bg-emerald-500'],
] as const

/** Plateforme web de suivi, comme dans l'application réelle. */
export function AppScreen({ withMap = true }: { withMap?: boolean }) {
  return (
    <div className="@container size-full">
      <div className="flex size-full bg-white text-[1.05cqw] text-neutral-800">
        <aside className="flex w-[17%] shrink-0 flex-col gap-[0.6cqw] border-r border-neutral-200 p-[1cqw]">
          <div className="mb-[1cqw] flex items-center gap-[0.7cqw]">
            <span className="grid size-[2.6cqw] place-items-center rounded-[0.6cqw] bg-blue-600 text-white">
              <MapPinned className="size-[1.5cqw]" aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block font-semibold">Suivi Agent</span>
              <span className="block text-[0.85cqw] text-neutral-500">Démo Abidjan</span>
            </span>
          </div>
          {NAV.map(([Icon, label, active]) => (
            <span
              key={label}
              className={cn(
                'flex items-center gap-[0.7cqw] rounded-[0.5cqw] px-[0.7cqw] py-[0.55cqw]',
                active ? 'bg-blue-50 font-medium text-blue-700' : 'text-neutral-600',
              )}
            >
              <Icon className="size-[1.2cqw] shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
              {label === 'Demandes de zone' && (
                <span className="ml-auto rounded-full bg-amber-500 px-[0.5cqw] text-[0.8cqw] font-semibold text-white">2</span>
              )}
            </span>
          ))}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[4.2cqw] shrink-0 items-center gap-[1cqw] border-b border-neutral-200 px-[1.4cqw]">
            <span className="rounded-full bg-amber-50 px-[0.9cqw] py-[0.3cqw] text-[0.9cqw] font-medium text-amber-700 ring-1 ring-amber-200">
              2 demandes de zone à traiter
            </span>
            <span className="ml-auto flex items-center gap-[0.5cqw] text-[0.9cqw] font-medium text-emerald-600">
              <span className="size-[0.7cqw] rounded-full bg-emerald-500" /> Temps réel actif
            </span>
            <Bell className="size-[1.3cqw] text-neutral-500" aria-hidden />
            <span className="grid size-[2.2cqw] place-items-center rounded-full bg-neutral-100 text-[0.85cqw] font-semibold">AK</span>
          </header>
          <div className="flex min-h-0 flex-1">
            <div className="relative min-w-0 flex-1">
              {withMap ? <LiveMap zoom={13} center={[5.328, -4.008]} /> : <MapPlaceholder />}
              <div className="landing-toast absolute top-[1.4cqw] left-1/2 z-[500] flex -translate-x-1/2 items-center gap-[0.6cqw] rounded-[0.8cqw] bg-white/95 px-[1cqw] py-[0.6cqw] text-[0.95cqw] shadow-lg ring-1 ring-black/5 backdrop-blur">
                <span className="size-[0.8cqw] rounded-full bg-rose-500" /> <b className="font-semibold">Awa Bamba</b> est sortie de sa zone
              </div>
            </div>
            <aside className="w-[27%] shrink-0 border-l border-neutral-200 p-[1.1cqw]">
              <div className="grid grid-cols-3 gap-[0.6cqw]">
                {[
                  ['12', 'En journée'],
                  ['1', 'En pause'],
                  ['1', 'Alerte'],
                ].map(([v, l], i) => (
                  <div key={l} className="rounded-[0.6cqw] bg-neutral-50 p-[0.7cqw]">
                    <p className={cn('text-[1.7cqw] leading-none font-semibold', i === 2 && 'text-rose-600')}>{v}</p>
                    <p className="mt-[0.3cqw] text-[0.8cqw] text-neutral-500">{l}</p>
                  </div>
                ))}
              </div>
              <p className="mt-[1.1cqw] mb-[0.5cqw] text-[0.8cqw] font-semibold tracking-wide text-neutral-500 uppercase">Agents</p>
              <div className="flex flex-col gap-[0.35cqw]">
                {PEOPLE.map(([ini, name, zone, status, dot]) => (
                  <div key={name} className="flex items-center gap-[0.7cqw] rounded-[0.6cqw] px-[0.4cqw] py-[0.45cqw]">
                    <span className="relative grid size-[2.2cqw] shrink-0 place-items-center rounded-full bg-blue-50 text-[0.8cqw] font-semibold text-blue-700">
                      {ini}
                      <span
                        className={cn('absolute -right-[0.1cqw] -bottom-[0.1cqw] size-[0.75cqw] rounded-full ring-2 ring-white', dot)}
                      />
                    </span>
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate font-medium">{name}</span>
                      <span className="block truncate text-[0.82cqw] text-neutral-500">
                        {zone} · {status}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Fond de carte stylisé (aperçus secondaires : évite de multiplier les cartes réelles). */
function MapPlaceholder() {
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" className="size-full bg-[#eef0ed]" aria-hidden>
      <path d="M0 150 C 80 130, 140 170, 220 150 S 340 120, 400 140 L400 175 C 330 160, 270 195, 200 185 S 70 160, 0 185Z" fill="#cfe3f3" />
      <path d="M0 60 L400 100 M120 0 L170 260 M0 230 L400 200 M300 0 L280 260 M40 0 L80 260" stroke="#fff" strokeWidth="6" />
      <path d="M0 60 L400 100 M120 0 L170 260 M0 230 L400 200 M300 0 L280 260" stroke="#f6d38c" strokeWidth="2" />
      <path d="M150 40 L250 55 L240 120 L140 110Z" fill="#2563eb" fillOpacity="0.12" stroke="#2563eb" strokeWidth="1.5" />
      <path d="M260 160 L350 170 L340 230 L250 220Z" fill="#0d9488" fillOpacity="0.12" stroke="#0d9488" strokeWidth="1.5" />
      {[
        [190, 80, '#15803d'],
        [215, 95, '#15803d'],
        [300, 195, '#15803d'],
        [120, 150, '#dc2626'],
      ].map(([x, y, c], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="9" fill={c as string} stroke="#fff" strokeWidth="2.5" />
        </g>
      ))}
    </svg>
  )
}

// --------------------------------------------------------------- iOS (iPhone)

/** Cadre commun d'un écran iOS : barre d'état, grand titre, contenu. */
function IosScreen({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="@container size-full">
      <div className="flex size-full flex-col text-[3.6cqw]">
        <StatusBar />
        <div className="px-[6cqw] pt-[9cqw]">
          <p className="text-[3.2cqw] font-semibold tracking-wide text-neutral-500 uppercase">{eyebrow}</p>
          <p className="text-[8.4cqw] leading-[1.1] font-bold tracking-tight">{title}</p>
        </div>
        <div className="flex-1 px-[5cqw] pt-[5cqw]">{children}</div>
      </div>
    </div>
  )
}

const Group = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('overflow-hidden rounded-[4cqw] bg-white', className)}>{children}</div>
)

export function ZoneScreen() {
  const zones = [
    ['Plateau', '1 place restante', true, true],
    ['Cocody', 'Complète', false, false],
    ['Adjamé', '3 places', true, false],
    ['Marcory', 'Illimitée', true, false],
  ] as const
  return (
    <IosScreen eyebrow="Lundi 6 octobre" title="Choisir ma zone">
      <Group>
        {zones.map(([name, places, open, selected], i) => (
          <div key={name} className={cn('flex items-center gap-[3cqw] px-[4cqw] py-[3.6cqw]', i > 0 && 'border-t border-neutral-100')}>
            <span className={cn('size-[2.4cqw] rounded-full', open ? 'bg-emerald-500' : 'bg-neutral-300')} />
            <span className="min-w-0 flex-1">
              <span className={cn('block font-semibold', !open && 'text-neutral-400')}>{name}</span>
              <span className="block text-[3cqw] text-neutral-500">{places}</span>
            </span>
            {selected && <Check className="size-[4.6cqw] text-blue-600" aria-hidden />}
          </div>
        ))}
      </Group>
      <div className="mt-[5cqw] rounded-full bg-blue-600 py-[3.6cqw] text-center font-semibold text-white">Valider Plateau</div>
    </IosScreen>
  )
}

export function DayScreen({ active = true }: { active?: boolean }) {
  const reduced = useReducedMotion()
  const [seconds, setSeconds] = useState(3 * 3600 + 42 * 60 + 8)
  useEffect(() => {
    if (!active || reduced) return
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [active, reduced])
  const h = Math.floor(seconds / 3600)
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  const circumference = 2 * Math.PI * 52
  return (
    <IosScreen eyebrow="Bonjour Koffi" title="Ma journée">
      <Group className="flex flex-col items-center px-[4cqw] py-[6cqw]">
        <div className="relative grid size-[46cqw] place-items-center">
          <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r="52" fill="none" stroke="#eef0f3" strokeWidth="9" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="url(#ring)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - Math.min(1, seconds / (8 * 3600)))}
            />
            <defs>
              <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#16a34a" />
              </linearGradient>
            </defs>
          </svg>
          <div className="text-center">
            <p className="text-[8cqw] leading-none font-bold tabular-nums">
              {h}:{m}
              <span className="text-[4cqw] text-neutral-400">:{s}</span>
            </p>
            <p className="mt-[1cqw] text-[3cqw] text-neutral-500">sur 8 h</p>
          </div>
        </div>
        <span className="mt-[4cqw] inline-flex items-center gap-[1.4cqw] rounded-full bg-emerald-50 px-[3cqw] py-[1.2cqw] text-[3.2cqw] font-semibold text-emerald-700">
          <span className="size-[1.8cqw] rounded-full bg-emerald-500" /> En journée · Plateau
        </span>
      </Group>
      <div className="mt-[4cqw] grid grid-cols-2 gap-[3cqw] text-[3.4cqw] font-semibold">
        <span className="flex items-center justify-center gap-[1.5cqw] rounded-full bg-white py-[3.4cqw]">
          <Pause className="size-[3.6cqw]" aria-hidden /> Pause
        </span>
        <span className="flex items-center justify-center gap-[1.5cqw] rounded-full bg-rose-500 py-[3.4cqw] text-white">
          <Square className="size-[3.4cqw]" aria-hidden /> Terminer
        </span>
      </div>
    </IosScreen>
  )
}

export function FormScreen({ active = true }: { active?: boolean }) {
  const reduced = useReducedMotion()
  const text = 'Pharmacie du Marché'
  // Saisie animée à la première apparition de l'écran.
  const [typed, setTyped] = useState(() => (active && !reduced ? 0 : text.length))
  useEffect(() => {
    if (!active || reduced) return
    let i = 0
    const timer = setInterval(() => {
      i += 1
      setTyped(i)
      if (i >= text.length) clearInterval(timer)
    }, 75)
    return () => clearInterval(timer)
  }, [active, reduced])
  const done = typed >= text.length
  return (
    <IosScreen eyebrow="Mission · 77 / 120" title="Nouvelle visite">
      <Group>
        {[
          ['Commerce', `${text.slice(0, typed)}${done ? '' : '|'}`],
          ['Client intéressé', 'Oui'],
          ['Montant de la commande', '125 000 FCFA'],
          ['Photo de la vitrine', '1 photo'],
        ].map(([label, value], i) => (
          <div key={label} className={cn('px-[4cqw] py-[3cqw]', i > 0 && 'border-t border-neutral-100')}>
            <p className="text-[2.9cqw] text-neutral-500">{label}</p>
            <p className="font-medium">{value}</p>
          </div>
        ))}
      </Group>
      <div
        className={cn(
          'mt-[5cqw] flex items-center justify-center gap-[1.5cqw] rounded-full py-[3.6cqw] font-semibold text-white transition-colors duration-500',
          done ? 'bg-emerald-600' : 'bg-blue-600',
        )}
      >
        {done ? (
          <>
            <Check className="size-[4cqw]" aria-hidden /> Envoyé
          </>
        ) : (
          'Envoyer'
        )}
      </div>
      <p className="mt-[3cqw] text-center text-[2.9cqw] text-neutral-500">Fonctionne même sans réseau</p>
    </IosScreen>
  )
}

export function GainsScreen({ active = true }: { active?: boolean }) {
  const reduced = useReducedMotion()
  const target = 58300
  const [value, setValue] = useState(target)
  useEffect(() => {
    if (!active || reduced) return
    const start = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / 1300)
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [active, reduced])
  return (
    <IosScreen eyebrow="Estimation · octobre" title="Mes gains">
      <Group className="p-[4.5cqw]">
        <p className="text-[9cqw] leading-none font-bold tracking-tight tabular-nums">
          {value.toLocaleString('fr-FR')}
          <span className="ml-[1.5cqw] text-[3.6cqw] font-semibold text-neutral-500">FCFA</span>
        </p>
        <div className="mt-[3cqw] h-[1.6cqw] overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full w-[38%] rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
        </div>
        <p className="mt-[1.6cqw] text-[2.9cqw] text-neutral-500">Jour 6 sur 31 · mise à jour en direct</p>
      </Group>
      <Group className="mt-[3cqw] text-[3.2cqw]">
        {[
          ['Fixe', '+40 000'],
          ['Journées validées · 3 × 2 500', '+7 500'],
          ['Formulaires · 12 × 150', '+1 800'],
          ['Objectif atteint', '+10 000'],
          ['Journée non clôturée', '−1 000'],
        ].map(([label, amount], i) => (
          <div key={label} className={cn('flex justify-between px-[4cqw] py-[2.6cqw]', i > 0 && 'border-t border-neutral-100')}>
            <span>{label}</span>
            <span className={cn('font-semibold tabular-nums', amount.startsWith('−') && 'text-rose-600')}>{amount}</span>
          </div>
        ))}
      </Group>
    </IosScreen>
  )
}

/** Écran d'iPhone selon l'étape du récit. */
export type PhoneScreen = 'zone' | 'day' | 'form' | 'gains'

export function PhoneScreens({ screen }: { screen: PhoneScreen }) {
  return (
    <div className="relative size-full">
      {(['zone', 'day', 'form', 'gains'] as const).map((s) => (
        <div
          key={s}
          className={cn(
            'absolute inset-0 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
            s === screen ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-[3%] scale-[0.98] opacity-0',
          )}
          aria-hidden={s !== screen}
        >
          {s === 'zone' && <ZoneScreen />}
          {s === 'day' && <DayScreen active={screen === 'day'} />}
          {s === 'form' && <FormScreen active={screen === 'form'} />}
          {s === 'gains' && <GainsScreen active={screen === 'gains'} />}
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------ petites scènes

/** File d'envoi hors connexion : les éléments partent un à un au retour du réseau. */
export function OfflineScene() {
  const reduced = useReducedMotion()
  const items = ['Visite · Pharmacie du Marché', 'Position · 10:42', 'Visite · Boutique Awa', 'Photo · vitrine', 'Fin de journée']
  const [step, setStep] = useState(reduced ? items.length + 1 : 0)
  useEffect(() => {
    if (reduced) return
    const timer = setInterval(() => setStep((s) => (s + 1) % (items.length + 4)), 900)
    return () => clearInterval(timer)
  }, [reduced, items.length])
  const online = step > 0
  return (
    <div className="flex h-full flex-col gap-2">
      <span
        className={cn(
          'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-500',
          online ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300',
        )}
      >
        {online ? <Check className="size-3.5" aria-hidden /> : <WifiOff className="size-3.5" aria-hidden />}
        {online ? 'Réseau retrouvé · envoi' : 'Hors connexion'}
      </span>
      {items.map((label, i) => {
        const sent = step > i + 1
        return (
          <div
            key={label}
            className={cn(
              'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition-all duration-500',
              sent ? 'bg-white/5 text-white/50' : 'bg-white/10 text-white',
            )}
          >
            {sent ? <Check className="size-4 text-emerald-400" aria-hidden /> : <Clock className="size-4 text-white/60" aria-hidden />}
            <span className="flex-1 truncate">{label}</span>
            <span className="text-[11px] text-white/50">{sent ? 'envoyé' : 'en attente'}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Notifications façon iOS qui arrivent les unes après les autres. */
export function AlertsScene() {
  const reduced = useReducedMotion()
  const all = [
    ['Hors zone', 'Awa Bamba est sortie du Plateau', 'bg-rose-500'],
    ['Signal perdu', 'Plus de position de Hervé Konan', 'bg-amber-500'],
    ['Demande de zone', 'Serge Gbagbo demande Cocody', 'bg-blue-600'],
    ['Position simulée', 'Application de localisation détectée', 'bg-rose-500'],
  ]
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    if (reduced) return
    const timer = setInterval(() => setOffset((o) => (o + 1) % all.length), 2600)
    return () => clearInterval(timer)
  }, [reduced, all.length])
  const shown = [0, 1, 2].map((i) => all[(offset + i) % all.length])
  return (
    <div className="relative h-full">
      {shown.map(([title, text, color], i) => (
        <div
          key={`${offset}-${i}`}
          className="landing-notif absolute inset-x-0 flex items-start gap-2.5 rounded-2xl bg-white/90 p-3 text-neutral-900 shadow-lg ring-1 ring-black/5 backdrop-blur"
          style={{ top: `${i * 18}%`, transform: `scale(${1 - i * 0.05})`, opacity: 1 - i * 0.25, zIndex: 3 - i }}
        >
          <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-white', color)}>
            <Bell className="size-3.5" aria-hidden />
          </span>
          <span className="min-w-0 text-[12px] leading-snug">
            <span className="block font-semibold">{title}</span>
            <span className="block truncate text-neutral-600">{text}</span>
          </span>
          <span className="ml-auto text-[10px] text-neutral-400">maint.</span>
        </div>
      ))}
    </div>
  )
}
