import type {
  AudiencesSection,
  BentoSection,
  BentoTile,
  CtaSection,
  FaqSection,
  FeatureSection,
  LandingCta,
  LandingSection,
  LandingVisual,
  PricingSection,
  PublicLanding,
  StatementSection,
  StatsSection,
  StorySection,
  TestimonialsSection,
} from '@suivi/shared'
import { Feature } from '@suivi/shared'
import '@fontsource-variable/inter'
import {
  ArrowRight,
  Check,
  ChevronDown,
  LayoutDashboard,
  Lock,
  MapPinned,
  Menu,
  Quote,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { BASE_FEATURES, featureLabel } from '@/lib/subscription'
import { cn } from '@/lib/utils'
import { IPhone, MacBook } from './devices'
import { gsap, useScrollScene } from './gsap'
import { LiveMap } from './live-map'
import { useInView, useReducedMotion } from './motion'
import { AlertsScene, AppScreen, DayScreen, GainsScreen, OfflineScene, PhoneScreens, type PhoneScreen } from './screens'

/**
 * Site vitrine. Animations pilotées par le défilement (GSAP ScrollTrigger), appareils et
 * écrans réalistes, vraie carte. Mise en page par requêtes de conteneur : le même rendu sert
 * au site et à l'aperçu de la console.
 */
export interface LandingProps {
  data: PublicLanding
  onAction: (cta: LandingCta) => void
  signedIn?: boolean
}

const ICONS: Record<string, LucideIcon> = {
  smartphone: Smartphone,
  users: Users,
  'layout-dashboard': LayoutDashboard,
  map: MapPinned,
  target: Target,
  wallet: Wallet,
  shield: ShieldCheck,
  sparkles: Sparkles,
}

const EASE = 'power3.out'

export function Landing({ data, onAction, signedIn = false }: LandingProps) {
  const sections = data.content.sections.filter((s) => s.enabled)
  return (
    <div className="landing @container bg-white font-[Inter_Variable,system-ui,sans-serif] text-[#1d1d1f] antialiased selection:bg-blue-600/20">
      <Nav data={data} onAction={onAction} signedIn={signedIn} />
      <Hero data={data} onAction={onAction} />
      {sections.map((section) => (
        <SectionView key={section.id} section={section} data={data} onAction={onAction} />
      ))}
      <Footer data={data} />
    </div>
  )
}

function SectionView({ section, data, onAction }: { section: LandingSection; data: PublicLanding; onAction: LandingProps['onAction'] }) {
  switch (section.type) {
    case 'statement':
      return <Statement section={section} />
    case 'bento':
      return <Bento section={section} />
    case 'stats':
      return <Stats section={section} />
    case 'feature':
      return <FeatureChapter section={section} />
    case 'audiences':
      return <Gallery section={section} />
    case 'story':
      return <Story section={section} />
    case 'pricing':
      return <Pricing section={section} data={data} onAction={onAction} />
    case 'testimonials':
      return <Testimonials section={section} />
    case 'faq':
      return <Faq section={section} />
    case 'cta':
      return <FinalCta section={section} onAction={onAction} />
  }
}

// ---------------------------------------------------------------- briques

/** Apparition au défilement : montée douce, la netteté revient. */
function useReveal(ref: RefObject<HTMLElement | null>) {
  useScrollScene(ref, ({ scroller, reduced }) => {
    if (reduced) return
    gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
      gsap.from(el, {
        y: 48,
        opacity: 0,
        filter: 'blur(6px)',
        duration: 1.1,
        ease: EASE,
        delay: Number(el.dataset.delay ?? 0),
        scrollTrigger: { trigger: el, scroller, start: 'top 88%' },
      })
    })
  })
}

function Pill({
  cta,
  variant = 'primary',
  onAction,
  size = 'md',
}: {
  cta: LandingCta
  variant?: 'primary' | 'ghost' | 'light' | 'outline-light'
  onAction: LandingProps['onAction']
  size?: 'md' | 'lg'
}) {
  return (
    <button
      type="button"
      onClick={() => onAction(cta)}
      className={cn(
        'group inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-all duration-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97]',
        size === 'lg' ? 'h-12 px-7 text-[17px]' : 'h-10 px-5 text-[15px]',
        variant === 'primary' && 'bg-[#0071e3] text-white hover:bg-[#0077ed]',
        variant === 'ghost' && 'text-[#0066cc] hover:underline',
        variant === 'light' && 'bg-white text-[#1d1d1f] hover:bg-white/90',
        variant === 'outline-light' && 'text-white ring-1 ring-white/30 hover:bg-white/10',
      )}
    >
      {cta.label}
      {variant === 'ghost' || variant === 'outline-light' ? (
        <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
      ) : null}
    </button>
  )
}

const Eyebrow = ({ children, dark }: { children: ReactNode; dark?: boolean }) =>
  children ? (
    <p className={cn('mb-4 text-[17px] font-semibold tracking-tight @3xl:text-xl', dark ? 'text-[#2997ff]' : 'text-[#0071e3]')}>
      {children}
    </p>
  ) : null

const Headline = ({ children, className }: { children: string; className?: string }) => (
  <h2
    className={cn(
      'text-[40px] leading-[1.06] font-semibold tracking-[-0.025em] whitespace-pre-line @3xl:text-[56px] @5xl:text-[72px]',
      className,
    )}
  >
    {children}
  </h2>
)

// ----------------------------------------------------------------- en-tête

function Nav({ data, onAction, signedIn }: { data: PublicLanding; onAction: LandingProps['onAction']; signedIn: boolean }) {
  const [open, setOpen] = useState(false)
  const links = data.content.sections.filter((s) => s.enabled && s.navLabel)
  const login: LandingCta = { label: signedIn ? 'Ouvrir mon espace' : 'Se connecter', action: 'login' }
  return (
    <header className="sticky top-0 z-[1000] bg-[rgba(251,251,253,0.72)] backdrop-blur-2xl backdrop-saturate-[1.8]">
      <nav className="mx-auto flex h-12 max-w-[980px] items-center gap-7 px-5 text-[13px]" aria-label="Navigation du site">
        <a href="#top" className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight whitespace-nowrap">
          <span className="grid size-6 place-items-center rounded-[7px] bg-gradient-to-b from-[#3b82f6] to-[#1d4ed8] text-white shadow-sm">
            <MapPinned className="size-3.5" aria-hidden />
          </span>
          {data.content.brand.name}
        </a>
        <div className="hidden flex-1 items-center justify-center gap-7 text-[#1d1d1f]/80 @4xl:flex">
          {links.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="whitespace-nowrap transition-colors hover:text-[#1d1d1f]">
              {s.navLabel}
            </a>
          ))}
        </div>
        <div className="ml-auto hidden items-center gap-4 @4xl:flex">
          <button
            type="button"
            className="cursor-pointer whitespace-nowrap text-[#1d1d1f]/80 hover:text-[#1d1d1f]"
            onClick={() => onAction(login)}
          >
            {login.label}
          </button>
          <button
            type="button"
            className="h-7 cursor-pointer rounded-full bg-[#0071e3] px-3.5 text-[12px] font-medium whitespace-nowrap text-white hover:bg-[#0077ed]"
            onClick={() => onAction(data.content.hero.primary)}
          >
            {data.content.hero.primary.label}
          </button>
        </div>
        <button
          type="button"
          className="ml-auto grid size-10 cursor-pointer place-items-center rounded-full @4xl:hidden"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </nav>
      <div className="h-px bg-black/[0.06]" />
      {open && (
        <div className="flex flex-col gap-1 px-6 pt-4 pb-8 @4xl:hidden">
          {links.map((s) => (
            <a key={s.id} href={`#${s.id}`} onClick={() => setOpen(false)} className="py-2 text-[28px] font-semibold tracking-tight">
              {s.navLabel}
            </a>
          ))}
          <div className="mt-6 flex flex-col gap-3">
            <Pill cta={data.content.hero.primary} onAction={onAction} size="lg" />
            <button
              type="button"
              className="h-12 cursor-pointer rounded-full text-[17px] ring-1 ring-black/10"
              onClick={() => onAction(login)}
            >
              {login.label}
            </button>
          </div>
        </div>
      )}
    </header>
  )
}

/**
 * En-tête : le titre s'efface pendant que l'ordinateur se redresse et vient au premier plan,
 * puis l'iPhone glisse à ses côtés. Section épinglée, animation liée au défilement.
 */
function Hero({ data, onAction }: { data: PublicLanding; onAction: LandingProps['onAction'] }) {
  const { hero } = data.content
  const ref = useRef<HTMLElement>(null)
  useScrollScene(ref, ({ scroller, reduced }) => {
    if (reduced) return
    gsap.from('[data-hero-in]', { y: 30, opacity: 0, filter: 'blur(8px)', duration: 1.2, ease: EASE, stagger: 0.12, delay: 0.1 })
    const mm = gsap.matchMedia()
    mm.add('(min-width: 768px)', () => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: ref.current, scroller, start: 'top top', end: '+=110%', scrub: 0.8, pin: true, invalidateOnRefresh: true },
      })
      // L'ordinateur part de 80 % de la hauteur et se pose à 9 % du haut : il finit entièrement visible.
      const rise = () => -(ref.current?.offsetHeight ?? 0) * 0.71
      tl.to('[data-hero-copy]', { y: -120, opacity: 0, scale: 0.94, ease: 'none' }, 0)
        .fromTo('[data-hero-device]', { y: 0, scale: 0.86, rotateX: 18 }, { y: rise, scale: 1, rotateX: 0, ease: 'none' }, 0)
        .fromTo('[data-hero-phone]', { x: 140, y: 80, opacity: 0, rotate: 6 }, { x: 0, y: 0, opacity: 1, rotate: 0, ease: 'none' }, 0.35)
    })
  })
  const lines = hero.title.split('\n')
  return (
    <section id="top" ref={ref} className="relative overflow-hidden bg-[#fbfbfd] @3xl:h-[var(--landing-vh,100vh)]">
      <div data-hero-copy className="relative z-10 mx-auto max-w-[980px] px-5 pt-14 text-center @3xl:pt-20">
        {hero.eyebrow && (
          <p data-hero-in className="mb-5 text-[17px] font-semibold text-[#bf4800] @3xl:text-[19px]">
            {hero.eyebrow}
          </p>
        )}
        <h1 className="text-[48px] leading-[1.04] font-semibold tracking-[-0.035em] @3xl:text-[80px] @5xl:text-[96px]">
          {lines.map((line, i) => (
            <span key={i} data-hero-in className="block">
              {line}
            </span>
          ))}
        </h1>
        <p data-hero-in className="mx-auto mt-6 max-w-[640px] text-[19px] leading-[1.42] text-[#6e6e73] @3xl:text-[21px]">
          {hero.subtitle}
        </p>
        <div data-hero-in className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <Pill cta={hero.primary} onAction={onAction} size="lg" />
          {hero.secondary && <Pill cta={hero.secondary} variant="ghost" onAction={onAction} size="lg" />}
        </div>
        <p data-hero-in className="mt-4 text-[12px] text-[#86868b]">
          {data.trialDays} jours d’essai gratuit, sans carte bancaire.
        </p>
      </div>
      <div className="relative mx-auto mt-12 max-w-[1100px] px-5 [perspective:1600px] @3xl:absolute @3xl:inset-x-0 @3xl:top-[80%] @3xl:mt-0">
        <div data-hero-device className="relative origin-top will-change-transform">
          {hero.visual === 'image' && hero.imageId ? (
            <img src={`/api/public/landing/assets/${hero.imageId}`} alt="" className="mx-auto w-full rounded-3xl shadow-2xl" />
          ) : (
            <MacBook>
              <AppScreen />
            </MacBook>
          )}
          <div data-hero-phone className="absolute right-[2%] -bottom-[6%] hidden w-[19%] @3xl:block">
            <IPhone>
              <DayScreen />
            </IPhone>
          </div>
        </div>
      </div>
    </section>
  )
}

// ------------------------------------------------------------- déclaration

/** Grande phrase : les mots s'éclairent un à un au fil du défilement. */
function Statement({ section }: { section: StatementSection }) {
  const ref = useRef<HTMLElement>(null)
  useScrollScene(ref, ({ scroller, reduced }) => {
    if (reduced) return
    gsap.fromTo(
      '[data-word]',
      { opacity: 0.14 },
      {
        opacity: 1,
        ease: 'none',
        stagger: 0.1,
        scrollTrigger: { trigger: ref.current, scroller, start: 'top 75%', end: 'bottom 55%', scrub: true },
      },
    )
  })
  const words = (text: string, accent: boolean) =>
    text
      .split(/\s+/)
      .filter(Boolean)
      .map((w, i) => (
        <span
          key={`${accent}-${i}`}
          data-word
          className={cn('inline-block', accent && 'bg-gradient-to-r from-[#0071e3] to-[#5ac8fa] bg-clip-text text-transparent')}
        >
          {w}&nbsp;
        </span>
      ))
  return (
    <section id={section.id} ref={ref} className="bg-white px-5 py-32 @3xl:py-48">
      <p className="mx-auto max-w-[980px] text-[36px] leading-[1.12] font-semibold tracking-[-0.025em] @3xl:text-[56px] @5xl:text-[64px]">
        {words(section.text, false)}
        {section.emphasis && words(section.emphasis, true)}
      </p>
    </section>
  )
}

// ------------------------------------------------------------------- bento

const SIZE: Record<BentoTile['size'], string> = {
  large: '@4xl:col-span-2 @4xl:row-span-2',
  wide: '@4xl:col-span-2',
  tall: '@4xl:row-span-2',
  small: '',
}

function Bento({ section }: { section: BentoSection }) {
  const ref = useRef<HTMLElement>(null)
  useScrollScene(ref, ({ scroller, reduced }) => {
    if (reduced) return
    gsap.from('[data-tile]', {
      y: 80,
      opacity: 0,
      scale: 0.96,
      duration: 1.1,
      ease: EASE,
      stagger: 0.08,
      scrollTrigger: { trigger: '[data-grid]', scroller, start: 'top 82%' },
    })
    gsap.from('[data-bento-head]', {
      y: 40,
      opacity: 0,
      duration: 1,
      ease: EASE,
      scrollTrigger: { trigger: ref.current, scroller, start: 'top 80%' },
    })
  })
  return (
    <section id={section.id} ref={ref} className="bg-[#f5f5f7] px-4 py-28 @3xl:px-6 @3xl:py-36">
      <div className="mx-auto max-w-[1180px]">
        <div data-bento-head className="mx-auto mb-14 max-w-[820px] text-center">
          <Eyebrow>{section.eyebrow}</Eyebrow>
          <Headline>{section.title}</Headline>
        </div>
        <div data-grid className="grid grid-flow-dense auto-rows-[minmax(300px,auto)] gap-4 @2xl:grid-cols-2 @4xl:auto-rows-[300px] @4xl:grid-cols-4">
          {section.tiles.map((tile, i) => (
            <BentoCard key={i} tile={tile} />
          ))}
        </div>
      </div>
    </section>
  )
}

const DARK_TILES: BentoTile['visual'][] = ['map', 'offline', 'security', 'devices']

function BentoCard({ tile }: { tile: BentoTile }) {
  const dark = DARK_TILES.includes(tile.visual)
  return (
    <article
      data-tile
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-[28px] transition-transform duration-500 hover:scale-[1.01]',
        dark ? 'bg-black text-white' : 'bg-white text-[#1d1d1f]',
        SIZE[tile.size],
      )}
    >
      <div className="relative z-10 p-7 pb-0">
        <h3 className="text-[21px] leading-tight font-semibold tracking-tight @3xl:text-[24px]">{tile.title}</h3>
        <p className={cn('mt-2 max-w-[34ch] text-[15px] leading-snug', dark ? 'text-white/60' : 'text-[#6e6e73]')}>{tile.text}</p>
      </div>
      <div className="relative min-h-[180px] flex-1">
        <TileScene tile={tile} />
      </div>
    </article>
  )
}

function TileScene({ tile }: { tile: BentoTile }) {
  switch (tile.visual) {
    case 'map':
      return (
        <div className="absolute inset-x-4 top-5 bottom-4 overflow-hidden rounded-[18px] ring-1 ring-white/10">
          <LiveMap dark zoom={13} center={[5.33, -4.008]} />
        </div>
      )
    case 'offline':
      return (
        <div className="absolute inset-x-5 top-6 bottom-5">
          <OfflineScene />
        </div>
      )
    case 'alerts':
      return (
        <div className="absolute inset-x-5 top-5 bottom-3">
          <AlertsScene />
        </div>
      )
    case 'payroll':
      return <PayrollTile />
    case 'missions':
      return <RingsTile />
    case 'security':
      return <SecurityTile />
    case 'devices':
      return (
        <div className="absolute inset-x-6 top-6 -bottom-6 flex items-end justify-center gap-3">
          <div className="w-[70%]">
            <MacBook>
              <AppScreen withMap={false} />
            </MacBook>
          </div>
          <div className="mb-3 w-[18%]">
            <IPhone>
              <GainsScreen active={false} />
            </IPhone>
          </div>
        </div>
      )
    case 'chart':
      return <ChartTile />
  }
}

function PayrollTile() {
  const [ref, visible] = useInView<HTMLDivElement>(0.4)
  const reduced = useReducedMotion()
  const [value, setValue] = useState(1532125)
  useEffect(() => {
    if (!visible || reduced) return
    const obj = { v: 0 }
    const tween = gsap.to(obj, { v: 1532125, duration: 1.8, ease: 'power2.out', onUpdate: () => setValue(Math.round(obj.v)) })
    return () => {
      tween.kill()
    }
  }, [visible, reduced])
  return (
    <div ref={ref} className="absolute inset-x-7 bottom-7 flex flex-col gap-3 @4xl:flex-row @4xl:items-end @4xl:justify-between">
      <div>
        <p className="text-[13px] text-[#6e6e73]">Paie de septembre · 19 personnes</p>
        <p className="text-[44px] leading-none font-semibold tracking-tight tabular-nums @3xl:text-[52px]">
          {value.toLocaleString('fr-FR')}
          <span className="ml-2 text-[17px] font-medium text-[#6e6e73]">FCFA</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {['Fixe', 'Journées', 'Formulaires', 'Primes', 'Retenues'].map((t, i) => (
          <span
            key={t}
            className={cn(
              'rounded-full px-3 py-1 text-[12px] font-medium',
              i === 4 ? 'bg-rose-50 text-rose-600' : 'bg-[#f5f5f7] text-[#1d1d1f]',
            )}
          >
            {t}
          </span>
        ))}
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-700">Payée · Mobile Money</span>
      </div>
    </div>
  )
}

/** Anneaux d'objectifs, façon Activité. */
function RingsTile() {
  const [ref, visible] = useInView<HTMLDivElement>(0.4)
  const rings = [
    { r: 54, color: '#ff2d55', pct: 0.82 },
    { r: 40, color: '#34c759', pct: 0.64 },
    { r: 26, color: '#0a84ff', pct: 1 },
  ]
  return (
    <div ref={ref} className="absolute inset-0 grid place-items-center pt-2">
      <svg viewBox="0 0 140 140" className="size-[150px] -rotate-90" aria-hidden>
        {rings.map((ring, i) => {
          const c = 2 * Math.PI * ring.r
          return (
            <g key={i}>
              <circle cx="70" cy="70" r={ring.r} fill="none" stroke={ring.color} strokeOpacity="0.15" strokeWidth="11" />
              <circle
                cx="70"
                cy="70"
                r={ring.r}
                fill="none"
                stroke={ring.color}
                strokeWidth="11"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={visible ? c * (1 - ring.pct) : c}
                style={{ transition: `stroke-dashoffset 1.6s cubic-bezier(0.16,1,0.3,1) ${i * 0.15}s` }}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function SecurityTile() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="relative flex flex-col items-center">
        <div className="landing-orb absolute top-0 size-40 rounded-full bg-[#0a84ff]/25 blur-2xl" aria-hidden />
        <div className="relative grid size-20 place-items-center rounded-[22px] bg-gradient-to-b from-[#1c1c1e] to-black ring-1 ring-white/15">
          <Lock className="size-9 text-white" aria-hidden />
        </div>
        <div className="relative mt-5 flex gap-2">
          {['Structure A', 'Structure B', 'Structure C'].map((s) => (
            <span key={s} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/70 ring-1 ring-white/10">
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChartTile() {
  const [ref, visible] = useInView<HTMLDivElement>(0.4)
  const bars = [38, 52, 46, 61, 68, 59, 74, 81, 77, 88]
  return (
    <div ref={ref} className="absolute inset-x-7 top-4 bottom-7 flex items-end gap-1.5" aria-hidden>
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[6px] bg-gradient-to-t from-[#0071e3] to-[#5ac8fa]"
          style={{ height: visible ? `${h}%` : '6%', transition: `height 1.2s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s` }}
        />
      ))}
    </div>
  )
}

// --------------------------------------------------------------- chapitres

/** Chapitre : titre, texte, puis l'appareil qui arrive en se redressant au défilement. */
function FeatureChapter({ section }: { section: FeatureSection }) {
  const ref = useRef<HTMLElement>(null)
  useReveal(ref)
  useScrollScene(ref, ({ scroller, reduced }) => {
    if (reduced) return
    gsap.fromTo(
      '[data-chapter-visual]',
      { y: 120, scale: 0.9, rotateX: 12 },
      {
        y: -40,
        scale: 1,
        rotateX: 0,
        ease: 'none',
        scrollTrigger: { trigger: ref.current, scroller, start: 'top bottom', end: 'bottom top', scrub: 1 },
      },
    )
  })
  const dark = !!section.dark
  return (
    <section
      id={section.id}
      ref={ref}
      className={cn('overflow-hidden px-5 py-28 @3xl:py-40', dark ? 'bg-black text-[#f5f5f7]' : 'bg-white')}
    >
      <div className="mx-auto max-w-[980px] text-center">
        <div data-reveal>
          <Eyebrow dark={dark}>{section.eyebrow}</Eyebrow>
          <Headline>{section.title}</Headline>
        </div>
        <p
          data-reveal
          data-delay="0.1"
          className={cn(
            'mx-auto mt-6 max-w-[680px] text-[19px] leading-[1.45] @3xl:text-[21px]',
            dark ? 'text-[#a1a1a6]' : 'text-[#6e6e73]',
          )}
        >
          {section.text}
        </p>
      </div>
      <div className="mx-auto mt-16 max-w-[1100px] [perspective:1600px]">
        <div data-chapter-visual className="will-change-transform">
          <ChapterVisual visual={section.visual} imageId={section.imageId} dark={dark} />
        </div>
      </div>
      {section.bullets.length > 0 && (
        <ul className="mx-auto mt-16 grid max-w-[980px] gap-6 @3xl:grid-cols-3">
          {section.bullets.map((b, i) => (
            <li
              key={i}
              data-reveal
              data-delay={String(i * 0.08)}
              className={cn(
                'border-t pt-5 text-[17px] leading-snug',
                dark ? 'border-white/15 text-[#d2d2d7]' : 'border-black/10 text-[#1d1d1f]',
              )}
            >
              <Check className={cn('mb-3 size-5', dark ? 'text-[#2997ff]' : 'text-[#0071e3]')} aria-hidden />
              {b}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ChapterVisual({ visual, imageId, dark }: { visual: LandingVisual; imageId?: string | null; dark: boolean }) {
  if (visual === 'image' && imageId)
    return <img src={`/api/public/landing/assets/${imageId}`} alt="" loading="lazy" className="mx-auto w-full rounded-[28px] shadow-2xl" />
  if (visual === 'map')
    return (
      <div
        className={cn(
          'relative mx-auto aspect-[16/9] w-full overflow-hidden rounded-[28px] ring-1',
          dark ? 'ring-white/10' : 'ring-black/5',
        )}
      >
        <LiveMap dark={dark} zoom={14} />
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.35)]" aria-hidden />
      </div>
    )
  if (visual === 'payroll' || visual === 'phone')
    return (
      <div className="mx-auto grid max-w-[760px] items-center gap-10 @3xl:grid-cols-2">
        <div className="mx-auto w-[62%] @3xl:w-[80%]">
          <IPhone>{visual === 'payroll' ? <GainsScreen /> : <DayScreen />}</IPhone>
        </div>
        <div className="hidden @3xl:block">
          <div className={cn('rounded-[28px] p-7', dark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-[#f5f5f7]')}>
            <p className={cn('text-[13px]', dark ? 'text-white/60' : 'text-[#6e6e73]')}>Paie de septembre · Koffi Brou</p>
            <p className="mt-1 text-[34px] font-semibold tracking-tight">72 750 FCFA</p>
            <div className="mt-5 space-y-2.5 text-[15px]">
              {[
                ['Fixe', '40 000'],
                ['Journées validées', '22 500'],
                ['Formulaires', '5 250'],
                ['Prime de fin de campagne', '5 000'],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between">
                  <span className={dark ? 'text-white/70' : 'text-[#6e6e73]'}>{l}</span>
                  <span className="font-medium tabular-nums">{v}</span>
                </div>
              ))}
            </div>
            <span className="mt-6 inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-[12px] font-semibold text-emerald-600">
              Payée · Orange Money
            </span>
          </div>
        </div>
      </div>
    )
  return (
    <MacBook>
      <AppScreen withMap={visual !== 'dashboard'} />
    </MacBook>
  )
}

// -------------------------------------------------------------------- récit

/** Le téléphone reste en place ; son écran suit chaque étape du récit. */
function Story({ section }: { section: StorySection }) {
  const ref = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const steps = section.steps
  useScrollScene(
    ref,
    ({ scroller, reduced }) => {
      if (reduced) return
      gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          scroller,
          start: 'top top',
          end: `+=${steps.length * 70}%`,
          pin: true,
          scrub: true,
          onUpdate: (self) => setActive(Math.min(steps.length - 1, Math.floor(self.progress * steps.length))),
        },
      })
    },
    [steps.length],
  )
  const screens: PhoneScreen[] = ['zone', 'day', 'form', 'gains']
  return (
    <section id={section.id} ref={ref} className="flex min-h-[var(--landing-vh,100vh)] items-center bg-[#f5f5f7] px-5 py-20">
      <div className="mx-auto grid w-full max-w-[1100px] items-center gap-14 @4xl:grid-cols-[1fr_320px]">
        <div>
          <Eyebrow>{section.eyebrow}</Eyebrow>
          <Headline>{section.title}</Headline>
          <ol className="mt-12 space-y-1">
            {steps.map((step, i) => (
              <li key={i} aria-current={i === active ? 'step' : undefined} className="relative pl-6">
                <span
                  className={cn(
                    'absolute top-2 left-0 h-[calc(100%-16px)] w-[3px] rounded-full transition-colors duration-500',
                    i === active ? 'bg-[#0071e3]' : 'bg-black/10',
                  )}
                  aria-hidden
                />
                <p
                  className={cn(
                    'py-2 text-[24px] font-semibold tracking-tight transition-colors duration-500 @3xl:text-[28px]',
                    i === active ? 'text-[#1d1d1f]' : 'text-[#1d1d1f]/30',
                  )}
                >
                  {step.title}
                </p>
                <div
                  className={cn(
                    'grid transition-all duration-500',
                    i === active ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <p className="overflow-hidden pb-3 text-[17px] leading-relaxed text-[#6e6e73]">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="mx-auto w-[64%] max-w-[300px] @4xl:w-full">
          <IPhone>
            <PhoneScreens screen={screens[active % screens.length]} />
          </IPhone>
        </div>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ galerie

const GALLERY_TONES = [
  'from-[#0a84ff] to-[#5e5ce6]',
  'from-[#30d158] to-[#0a84ff]',
  'from-[#ff9f0a] to-[#ff375f]',
  'from-[#bf5af2] to-[#5e5ce6]',
  'from-[#64d2ff] to-[#0a84ff]',
  'from-[#ff375f] to-[#bf5af2]',
]

/** Galerie horizontale : les cartes défilent latéralement pendant que la section reste en place. */
function Gallery({ section }: { section: AudiencesSection }) {
  const ref = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  useScrollScene(
    ref,
    ({ scroller, reduced }) => {
      if (reduced) return
      const mm = gsap.matchMedia()
      mm.add('(min-width: 768px)', () => {
        const distance = () => Math.max(0, (track.current?.scrollWidth ?? 0) - (ref.current?.clientWidth ?? 0) + 80)
        gsap.to(track.current, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: ref.current,
            scroller,
            start: 'top top',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        })
      })
    },
    [section.items.length],
  )
  return (
    <section
      id={section.id}
      ref={ref}
      className="overflow-hidden bg-white py-28 @3xl:flex @3xl:min-h-[var(--landing-vh,100vh)] @3xl:flex-col @3xl:justify-center @3xl:py-16"
    >
      <div className="mx-auto w-full max-w-[1100px] px-5">
        <Eyebrow>{section.eyebrow}</Eyebrow>
        <Headline>{section.title}</Headline>
      </div>
      <div className="mt-12 overflow-x-auto px-5 [scrollbar-width:none] @3xl:overflow-visible">
        <div ref={track} className="flex w-max snap-x snap-mandatory gap-5 @3xl:pl-[max(0px,calc((100cqw-1100px)/2))]">
          {section.items.map((item, i) => {
            const Icon = ICONS[item.icon ?? ''] ?? Sparkles
            const tone = GALLERY_TONES[i % GALLERY_TONES.length]
            return (
              <article
                key={i}
                className="relative flex h-[440px] w-[300px] shrink-0 snap-start flex-col overflow-hidden rounded-[28px] bg-black p-8 text-white @3xl:h-[500px] @3xl:w-[400px]"
              >
                <div
                  className={cn('absolute -top-24 -right-24 size-72 rounded-full bg-gradient-to-br opacity-70 blur-3xl', tone)}
                  aria-hidden
                />
                <span className={cn('relative grid size-14 place-items-center rounded-[16px] bg-gradient-to-br shadow-lg', tone)}>
                  <Icon className="size-7" aria-hidden />
                </span>
                <div className="relative mt-auto">
                  <h3 className="text-[32px] leading-tight font-semibold tracking-tight">{item.title}</h3>
                  <p className="mt-3 text-[17px] leading-relaxed text-white/70">{item.text}</p>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ chiffres

function Stats({ section }: { section: StatsSection }) {
  const ref = useRef<HTMLElement>(null)
  useScrollScene(ref, ({ scroller, reduced }) => {
    if (reduced) return
    gsap.utils.toArray<HTMLElement>('[data-count]').forEach((el) => {
      const raw = el.dataset.count ?? ''
      const match = /^(\D*)(\d+)(.*)$/.exec(raw)
      if (!match) return
      const target = Number(match[2])
      const obj = { v: 0 }
      gsap.to(obj, {
        v: target,
        duration: 1.6,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, scroller, start: 'top 85%' },
        onUpdate: () => {
          el.textContent = `${match[1]}${Math.round(obj.v)}${match[3]}`
        },
      })
    })
  })
  return (
    <section id={section.id} ref={ref} className="bg-black px-5 py-28 text-white @3xl:py-36">
      <div className="mx-auto grid max-w-[1100px] grid-cols-2 gap-x-8 gap-y-14 @4xl:grid-cols-4">
        {section.items.map((item, i) => (
          <div key={i}>
            <p
              data-count={item.value}
              className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-[56px] leading-none font-semibold tracking-tight text-transparent tabular-nums @4xl:text-[72px]"
            >
              {item.value}
            </p>
            <p className="mt-4 max-w-[16rem] text-[15px] leading-snug text-[#a1a1a6]">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ------------------------------------------------------------------- tarifs

function Pricing({ section, data, onAction }: { section: PricingSection; data: PublicLanding; onAction: LandingProps['onAction'] }) {
  const ref = useRef<HTMLElement>(null)
  useReveal(ref)
  const [annual, setAnnual] = useState(false)
  const money = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v)
  const unit = data.currency === 'XOF' ? 'FCFA' : data.currency
  const highlighted = data.plans.length >= 2 ? Math.floor(data.plans.length / 2) : -1
  return (
    <section id={section.id} ref={ref} className="bg-[#f5f5f7] px-5 py-28 @3xl:py-40">
      <div className="mx-auto max-w-[1100px]">
        <div data-reveal className="mx-auto max-w-[780px] text-center">
          <Eyebrow>{section.eyebrow}</Eyebrow>
          <Headline>{section.title}</Headline>
          {section.subtitle && <p className="mt-6 text-[19px] text-[#6e6e73] @3xl:text-[21px]">{section.subtitle}</p>}
        </div>
        {data.annualDiscountPercent > 0 && (
          <div data-reveal className="mt-10 flex justify-center">
            <div className="inline-flex rounded-full bg-[#e8e8ed] p-1 text-[14px]" role="radiogroup" aria-label="Facturation">
              {[false, true].map((a) => (
                <button
                  key={String(a)}
                  type="button"
                  role="radio"
                  aria-checked={annual === a}
                  onClick={() => setAnnual(a)}
                  className={cn(
                    'cursor-pointer rounded-full px-5 py-2 font-medium transition-all duration-300',
                    annual === a ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73]',
                  )}
                >
                  {a ? `Annuel · −${data.annualDiscountPercent} %` : 'Mensuel'}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className={cn('mt-12 grid items-stretch gap-5', data.plans.length >= 3 ? '@4xl:grid-cols-3' : '@3xl:grid-cols-2')}>
          {data.plans.map((plan, i) => {
            const best = i === highlighted
            const price = annual ? Math.round((plan.monthlyPrice * (100 - data.annualDiscountPercent)) / 100) : plan.monthlyPrice
            return (
              <div
                key={plan.code}
                data-reveal
                data-delay={String(i * 0.08)}
                className={cn('relative rounded-[30px] p-[1.5px]', best && 'landing-border')}
              >
                <div className={cn('relative flex h-full flex-col rounded-[29px] p-8', best ? 'bg-[#1d1d1f] text-white' : 'bg-white')}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[24px] font-semibold tracking-tight">{plan.name}</h3>
                    {best && <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-white">Le plus choisi</span>}
                  </div>
                  <p className={cn('mt-2 min-h-12 text-[15px] leading-snug', best ? 'text-white/60' : 'text-[#6e6e73]')}>
                    {plan.description}
                  </p>
                  <p className="mt-8 flex items-baseline gap-1.5">
                    <span className="text-[48px] leading-none font-semibold tracking-tight tabular-nums">{money(price)}</span>
                    <span className={cn('text-[15px]', best ? 'text-white/60' : 'text-[#6e6e73]')}>{unit} / mois</span>
                  </p>
                  <p className={cn('mt-3 text-[15px]', best ? 'text-white/80' : 'text-[#1d1d1f]')}>
                    {plan.includedLeads} chef{plan.includedLeads > 1 ? 's' : ''} d’équipe · {plan.includedAgents} agents
                  </p>
                  <p className={cn('text-[13px]', best ? 'text-white/50' : 'text-[#86868b]')}>
                    puis {money(plan.extraAgentPrice)} {unit} par agent supplémentaire
                  </p>
                  <button
                    type="button"
                    onClick={() => onAction({ label: 'Essayer', action: 'signup' })}
                    className={cn(
                      'mt-8 h-12 w-full cursor-pointer rounded-full text-[15px] font-medium transition-colors duration-300',
                      best ? 'bg-[#0071e3] text-white hover:bg-[#0077ed]' : 'bg-[#1d1d1f] text-white hover:bg-black',
                    )}
                  >
                    Essayer {data.trialDays} jours gratuitement
                  </button>
                  <ul className={cn('mt-8 space-y-3 border-t pt-8 text-[15px]', best ? 'border-white/10' : 'border-black/5')}>
                    {[
                      ...BASE_FEATURES,
                      ...Object.values(Feature)
                        .filter((f) => plan.features.includes(f))
                        .map((f) => featureLabel[f]),
                    ].map((label) => (
                      <li key={label} className="flex gap-3">
                        <Check className={cn('mt-0.5 size-[18px] shrink-0', best ? 'text-[#2997ff]' : 'text-[#0071e3]')} aria-hidden />
                        <span className={best ? 'text-white/80' : 'text-[#1d1d1f]'}>{label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ------------------------------------------------------- témoignages, FAQ, fin

function Testimonials({ section }: { section: TestimonialsSection }) {
  const ref = useRef<HTMLElement>(null)
  useReveal(ref)
  return (
    <section id={section.id} ref={ref} className="bg-white px-5 py-28 @3xl:py-36">
      <div className="mx-auto max-w-[1100px]">
        <div data-reveal>
          <Headline>{section.title}</Headline>
        </div>
        <div className="mt-14 grid gap-5 @3xl:grid-cols-2 @5xl:grid-cols-3">
          {section.items.map((t, i) => (
            <figure key={i} data-reveal data-delay={String(i * 0.08)} className="rounded-[28px] bg-[#f5f5f7] p-8">
              <Quote className="size-7 text-[#0071e3]" aria-hidden />
              <blockquote className="mt-5 text-[21px] leading-snug font-medium tracking-tight">« {t.quote} »</blockquote>
              <figcaption className="mt-6 text-[15px]">
                <span className="font-semibold">{t.author}</span>
                {t.role && <span className="text-[#6e6e73]"> · {t.role}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

function Faq({ section }: { section: FaqSection }) {
  const ref = useRef<HTMLElement>(null)
  useReveal(ref)
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section id={section.id} ref={ref} className="bg-white px-5 py-28 @3xl:py-36">
      <div className="mx-auto max-w-[820px]">
        <div data-reveal>
          <Headline className="text-center">{section.title}</Headline>
        </div>
        <div data-reveal className="mt-14 border-t border-black/10">
          {section.items.map((item, i) => (
            <div key={i} className="border-b border-black/10">
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between gap-6 py-6 text-left text-[21px] font-semibold tracking-tight"
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? null : i)}
              >
                {item.question}
                <ChevronDown
                  className={cn('size-6 shrink-0 text-[#86868b] transition-transform duration-500', open === i && 'rotate-180')}
                  aria-hidden
                />
              </button>
              <div
                className={cn(
                  'grid transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
                  open === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                )}
              >
                <p className="overflow-hidden pb-6 text-[17px] leading-relaxed text-[#6e6e73]">{item.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta({ section, onAction }: { section: CtaSection; onAction: LandingProps['onAction'] }) {
  const ref = useRef<HTMLElement>(null)
  useScrollScene(ref, ({ scroller, reduced }) => {
    if (reduced) return
    gsap.fromTo(
      '[data-cta-card]',
      { scale: 0.88 },
      { scale: 1, ease: 'none', scrollTrigger: { trigger: ref.current, scroller, start: 'top bottom', end: 'center center', scrub: 1 } },
    )
  })
  return (
    <section id={section.id} ref={ref} className="bg-white px-4 pb-24">
      <div
        data-cta-card
        className="landing-grain relative mx-auto max-w-[1180px] overflow-hidden rounded-[36px] bg-black px-6 py-28 text-center text-white @3xl:py-40"
      >
        <div
          className="landing-orb pointer-events-none absolute top-[-30%] left-1/2 size-[44rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(10,132,255,0.55),transparent_60%)] blur-2xl"
          aria-hidden
        />
        <div className="relative">
          <h2 className="text-[44px] leading-[1.05] font-semibold tracking-[-0.03em] whitespace-pre-line @3xl:text-[72px]">
            {section.title}
          </h2>
          {section.text && <p className="mx-auto mt-6 max-w-[560px] text-[19px] text-[#a1a1a6] @3xl:text-[21px]">{section.text}</p>}
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Pill cta={section.primary} variant="light" onAction={onAction} size="lg" />
            {section.secondary && <Pill cta={section.secondary} variant="outline-light" onAction={onAction} size="lg" />}
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer({ data }: { data: PublicLanding }) {
  const { footer, brand } = data.content
  const [year] = useState(() => new Date().getFullYear())
  return (
    <footer className="bg-[#f5f5f7] px-5 py-12 text-[12px] text-[#6e6e73]">
      <div className="mx-auto flex max-w-[980px] flex-col gap-6 @3xl:flex-row @3xl:items-start @3xl:justify-between">
        <div className="max-w-sm">
          <p className="text-[14px] font-semibold text-[#1d1d1f]">{brand.name}</p>
          {footer.text && <p className="mt-2 leading-relaxed">{footer.text}</p>}
        </div>
        <address className="flex flex-col gap-1.5 not-italic">
          {footer.email && (
            <a href={`mailto:${footer.email}`} className="hover:text-[#1d1d1f] hover:underline">
              {footer.email}
            </a>
          )}
          {footer.phone && (
            <a href={`tel:${footer.phone.replace(/\s/g, '')}`} className="hover:text-[#1d1d1f] hover:underline">
              {footer.phone}
            </a>
          )}
          {footer.address && <span>{footer.address}</span>}
        </address>
      </div>
      <p className="mx-auto mt-8 max-w-[980px] border-t border-black/10 pt-6">
        Copyright © {year} {brand.name}. Tous droits réservés.
      </p>
    </footer>
  )
}
