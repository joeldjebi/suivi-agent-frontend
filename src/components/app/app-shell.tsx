import { useQuery } from '@tanstack/react-query'
import { Feature, Role, SubscriptionStatus } from '@suivi/shared'
import { LogoMark } from './logo'
import {
  ClipboardCheck,
  ClipboardList,
  LifeBuoy,
  Loader2,
  Lock,
  LogOut,
  Map as MapIcon,
  MapPinned,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  Settings,
  Target,
  Users,
  Wallet,
  type LucideIcon,
  BellRing,
  BarChart3,
  BookOpen,
  CreditCard,
  FileClock,
  History,
  Receipt,
  Shapes,
  Siren,
  Store,
  Package,
  Smartphone,
  UserCog,
  UsersRound,
} from 'lucide-react'
import { useOpenAlerts } from '@/lib/alerts'
import { api } from '@/lib/api'
import { SosBanner } from './sos-banner'
import { useOnboarding } from '@/lib/onboarding'
import { useSupportAnswers } from '@/lib/support-queries'
import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePendingRequests } from '@/lib/queries'
import { usePersistentState } from '@/lib/use-persistent-state'
import { useAuth, useMe } from '@/lib/auth'
import { fullName, initials } from '@/lib/format'
import { roleLabel } from '@/lib/labels'
import { SocketProvider, useSocketConnected } from '@/lib/socket'
import { cn } from '@/lib/utils'
import { NotificationsButton } from './notifications'
import { SubscriptionBanner } from './subscription-banner'
import { SuspendedScreen } from './suspended-screen'
import { RouteErrorBoundary } from './route-error'

interface NavTab {
  to: string
  label: string
  icon: LucideIcon
  roles: Role[]
  /** Visible uniquement si la structure utilise les groupes. */
  groupsOnly?: boolean
  /** Fonctionnalité réservée à certaines formules : cadenas si elle n'est pas incluse. */
  feature?: Feature
}

interface NavSection {
  label: string
  icon: LucideIcon
  /** Pages de la rubrique, en onglets ; la première ouvre la rubrique. */
  tabs: NavTab[]
}

const ADMIN = [Role.Admin]
const STAFF = [Role.Admin, Role.TeamLead]

/**
 * Menu court : une entrée par rubrique, ses pages en onglets en haut de l'écran. Les adresses
 * des pages ne changent pas (liens du manuel, des notifications, favoris).
 */
const NAV: NavSection[] = [
  {
    label: 'En direct',
    icon: MapIcon,
    tabs: [
      { to: '/map', label: 'Carte', icon: MapIcon, roles: STAFF },
      { to: '/alerts', label: 'Alertes', icon: Siren, roles: STAFF },
      { to: '/approvals', label: 'Demandes de zone', icon: ClipboardCheck, roles: STAFF },
    ],
  },
  {
    label: 'Rapports',
    icon: ClipboardList,
    tabs: [
      { to: '/report', label: 'Bilan du jour', icon: ClipboardList, roles: STAFF },
      { to: '/history', label: 'Historique des journées', icon: History, roles: STAFF },
      { to: '/stats', label: 'Statistiques', icon: BarChart3, roles: ADMIN, feature: Feature.Stats },
    ],
  },
  {
    label: 'Missions',
    icon: Target,
    tabs: [
      { to: '/missions', label: 'Missions', icon: Target, roles: STAFF, feature: Feature.Missions },
      { to: '/mission-types', label: 'Formulaires', icon: Shapes, roles: ADMIN, feature: Feature.Missions },
    ],
  },
  {
    label: 'Équipe',
    icon: Users,
    tabs: [
      { to: '/users', label: 'Agents et comptes', icon: Users, roles: STAFF },
      { to: '/team-leads', label: 'Chefs d’équipe', icon: UserCog, roles: ADMIN, feature: Feature.TeamLeads },
      { to: '/groups', label: 'Groupes', icon: UsersRound, roles: STAFF, groupsOnly: true, feature: Feature.Groups },
    ],
  },
  { label: 'Zones', icon: MapPinned, tabs: [{ to: '/zones', label: 'Zones', icon: MapPinned, roles: STAFF }] },
  {
    label: 'Points de vente',
    icon: Store,
    tabs: [
      { to: '/outlets', label: 'Points de vente', icon: Store, roles: STAFF, feature: Feature.PointsOfSale },
      { to: '/products', label: 'Produits', icon: Package, roles: STAFF, feature: Feature.ProductAudits },
    ],
  },
  {
    label: 'Messages',
    icon: BellRing,
    tabs: [{ to: '/broadcasts', label: 'Notifications aux équipes', icon: BellRing, roles: ADMIN, feature: Feature.PushNotifications }],
  },
  {
    label: 'Rémunération',
    icon: Wallet,
    tabs: [{ to: '/pay', label: 'Rémunération', icon: Wallet, roles: STAFF, feature: Feature.Payroll }],
  },
  {
    label: 'Paramètres',
    icon: Settings,
    tabs: [
      { to: '/settings', label: 'Général', icon: Settings, roles: ADMIN },
      { to: '/branding', label: 'Application mobile', icon: Smartphone, roles: ADMIN, feature: Feature.Branding },
      { to: '/subscription', label: 'Abonnement', icon: CreditCard, roles: ADMIN },
      { to: '/billing', label: 'Facturation', icon: Receipt, roles: ADMIN },
      { to: '/audit', label: 'Journal d’accès', icon: FileClock, roles: ADMIN, feature: Feature.Audit },
    ],
  },
  {
    label: 'Aide',
    icon: LifeBuoy,
    tabs: [
      { to: '/start', label: 'Bien démarrer', icon: Rocket, roles: ADMIN },
      { to: '/help', label: 'Documentation', icon: BookOpen, roles: STAFF },
      { to: '/support', label: 'Support', icon: LifeBuoy, roles: STAFF },
    ],
  },
]

/** L'adresse appartient-elle à cet onglet (page et ses sous-pages) ? */
const inTab = (path: string, to: string) => path === to || path.startsWith(`${to}/`)

/** Onglets visibles pour cet utilisateur (rôle, groupes). */
function useVisibleNav() {
  const { user, settings } = useMe()
  return NAV.map((s) => ({
    ...s,
    tabs: s.tabs.filter((t) => t.roles.includes(user.role) && (!t.groupsOnly || settings.useGroups)),
  })).filter((s) => s.tabs.length > 0)
}

/** Compteurs par page : alertes en cours, demandes de zone, réponses du support. */
function useNavBadges() {
  const { user } = useMe()
  const pending = usePendingRequests()
  const alerts = useOpenAlerts(user.role !== Role.Agent).data?.length ?? 0
  const answers = useSupportAnswers()
  return {
    '/alerts': { count: alerts, color: 'bg-status-alert' },
    '/approvals': { count: pending, color: 'bg-status-paused' },
    '/support': { count: answers, color: 'bg-primary' },
  } as Record<string, { count: number; color: string } | undefined>
}

function Navigation({ onNavigate, collapsed = false, onToggle }: { onNavigate?: () => void; collapsed?: boolean; onToggle?: () => void }) {
  const { user, tenant, subscription } = useMe()
  const sections = useVisibleNav()
  const badges = useNavBadges()
  const { pathname } = useLocation()
  return (
    <nav
      aria-label="Navigation principale"
      className={cn('flex h-full flex-col gap-1 overflow-y-auto p-3', collapsed && 'items-center px-2')}
    >
      <div className={cn('mb-3 flex items-center gap-2 px-2 pt-1', collapsed && 'px-0')}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <LogoMark className="size-5" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Suivi Agent</p>
            <p className="truncate text-xs text-muted-foreground">{tenant.name}</p>
          </div>
        )}
      </div>
      {user.role === Role.Admin && (
        <div className="mb-3 w-full">
          <OnboardingLink collapsed={collapsed} onNavigate={onNavigate} />
        </div>
      )}
      {sections.map((section) => {
        const active = section.tabs.some((t) => inTab(pathname, t.to))
        // Compteur de la rubrique : le plus urgent de ses pages (alertes avant demandes).
        const badge = section.tabs.map((t) => badges[t.to]).find((b) => b && b.count > 0)
        const total = section.tabs.reduce((n, t) => n + (badges[t.to]?.count ?? 0), 0)
        const locked = section.tabs.every((t) => t.feature && !subscription.features.includes(t.feature))
        const link = (
          <NavLink
            key={section.label}
            to={section.tabs[0].to}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            aria-label={collapsed ? `${section.label}${total ? `, ${total} à traiter` : ''}` : undefined}
            className={cn(
              'relative flex h-10 w-full items-center gap-3 rounded-md px-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground',
              collapsed && 'justify-center px-0',
              active && 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent',
            )}
          >
            <section.icon className="size-[18px] shrink-0" aria-hidden />
            {!collapsed && <span className="flex-1 truncate">{section.label}</span>}
            {!collapsed && locked && <Lock className="size-3.5 text-muted-foreground" aria-label="Non inclus dans votre formule" />}
            {badge &&
              (collapsed ? (
                <span className={cn('absolute top-1 right-1 size-2 rounded-full', badge.color)} aria-hidden />
              ) : (
                <span className={cn('rounded-full px-1.5 text-[11px] leading-5 font-semibold text-white tabular-nums', badge.color)}>
                  {total}
                </span>
              ))}
          </NavLink>
        )
        if (collapsed)
          return (
            <Tooltip key={section.label}>
              <TooltipTrigger render={<div />}>{link}</TooltipTrigger>
              <TooltipContent side="right">{section.label}</TooltipContent>
            </Tooltip>
          )
        // Rubrique ouverte : ses pages juste en dessous, pour voir d'un coup d'œil les options.
        return (
          <div key={section.label} className="flex w-full flex-col">
            {link}
            {active && section.tabs.length > 1 && (
              <ul className="mt-0.5 mb-1 ml-[21px] flex flex-col gap-0.5 border-l-2 border-primary/20 pl-2">
                {section.tabs.map((t) => {
                  const on = inTab(pathname, t.to)
                  const count = badges[t.to]?.count ?? 0
                  return (
                    <li key={t.to}>
                      <Link
                        to={t.to}
                        onClick={onNavigate}
                        aria-current={on ? 'page' : undefined}
                        className={cn(
                          'flex h-8 items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                          on && 'font-semibold text-primary hover:text-primary',
                        )}
                      >
                        <span className="flex-1 truncate">{t.label}</span>
                        {t.feature && !subscription.features.includes(t.feature) && (
                          <Lock className="size-3 text-muted-foreground" aria-label="Non inclus dans votre formule" />
                        )}
                        {count > 0 && <span className="text-[11px] font-semibold tabular-nums">{count}</span>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
      {onToggle && (
        <Button
          variant="ghost"
          size="sm"
          className={cn('mt-auto text-muted-foreground', collapsed ? 'w-9 px-0' : 'justify-start')}
          aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
          onClick={onToggle}
        >
          {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
          {!collapsed && 'Replier le menu'}
        </Button>
      )}
    </nav>
  )
}

/** Onglets de la rubrique ouverte (plusieurs pages) : en haut de l'écran, au-dessus de la page. */
function SectionTabs() {
  const { subscription } = useMe()
  const sections = useVisibleNav()
  const badges = useNavBadges()
  const { pathname } = useLocation()
  const section = sections.find((s) => s.tabs.some((t) => inTab(pathname, t.to)))
  if (!section || section.tabs.length < 2) return null
  return (
    <nav aria-label={`Pages de la rubrique ${section.label}`} className="shrink-0 border-b bg-card px-3 py-2 sm:px-4">
      <div className="flex items-center gap-3 overflow-x-auto">
        <span className="hidden shrink-0 items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:flex">
          <section.icon className="size-3.5" aria-hidden />
          {section.label}
        </span>
        <div className="flex shrink-0 gap-1 rounded-lg bg-muted p-1">
          {section.tabs.map((t) => {
            const active = inTab(pathname, t.to)
            const badge = badges[t.to]
            return (
              <Link
                key={t.to}
                to={t.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground',
                  active && 'bg-card text-foreground shadow-sm ring-1 ring-border hover:bg-card',
                )}
              >
                <t.icon className={cn('size-4', active ? 'text-primary' : '')} aria-hidden />
                {t.label}
                {t.feature && !subscription.features.includes(t.feature) && (
                  <Lock className="size-3 text-muted-foreground" aria-label="Non inclus dans votre formule" />
                )}
                {badge && badge.count > 0 && (
                  <span className={cn('rounded-full px-1.5 text-[11px] leading-5 font-semibold text-white tabular-nums', badge.color)}>
                    {badge.count}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

/** Guide « Bien démarrer » en tête du menu, tant qu'il n'est ni terminé ni masqué. */
function OnboardingLink({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { data } = useOnboarding()
  if (!data || data.dismissed || data.completed) return null
  const done = data.steps.filter((s) => s.done).length
  const progress = `${done}/${data.steps.length}`
  const link = (
    <NavLink
      to="/start"
      onClick={onNavigate}
      aria-label={collapsed ? `Bien démarrer, ${done} étapes sur ${data.steps.length}` : undefined}
      className={({ isActive }) =>
        cn(
          'flex h-10 w-full items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10',
          collapsed && 'size-9 justify-center px-0',
          isActive && 'bg-primary/10',
        )
      }
    >
      <Rocket className="size-4 shrink-0" aria-hidden />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">Bien démarrer</span>
          <span className="text-xs tabular-nums">{progress}</span>
        </>
      )}
    </NavLink>
  )
  return collapsed ? (
    <Tooltip>
      <TooltipTrigger render={<div />}>{link}</TooltipTrigger>
      <TooltipContent side="right">Bien démarrer · {progress}</TooltipContent>
    </Tooltip>
  ) : (
    link
  )
}

/** Rappel visible des demandes à traiter (alerte critique en évidence). */
function PendingAlert() {
  const pending = usePendingRequests()
  if (!pending) return null
  return (
    <Link
      to="/approvals"
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-status-paused/30 bg-status-paused/10 px-3 text-xs font-medium text-status-paused transition-colors hover:bg-status-paused/15"
    >
      <ClipboardCheck className="size-3.5" aria-hidden />
      {pending}
      <span className="hidden sm:inline">demande{pending > 1 ? 's' : ''} de zone à traiter</span>
      <span className="sm:hidden">à traiter</span>
    </Link>
  )
}

function ConnectionIndicator() {
  const connected = useSocketConnected()
  return (
    <span
      role="status"
      className={cn(
        'hidden items-center gap-1.5 text-xs font-medium sm:inline-flex',
        connected ? 'text-status-active' : 'text-status-paused',
      )}
    >
      <span className="relative flex size-2" aria-hidden>
        {connected && <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-active opacity-60" />}
        <span className={cn('relative inline-flex size-2 rounded-full', connected ? 'bg-status-active' : 'bg-status-paused')} />
      </span>
      {connected ? 'Temps réel actif' : 'Reconnexion…'}
    </span>
  )
}

function UserMenu() {
  const { user } = useMe()
  const { logout } = useAuth()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Menu du compte" />}>
        <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold">{initials(user)}</span>
        <span className="hidden text-left text-sm md:block">{fullName(user)}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <p className="font-medium">{fullName(user)}</p>
            <p className="text-xs font-normal text-muted-foreground">
              {roleLabel[user.role]} · {user.email}
            </p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void logout()}>
          <LogOut aria-hidden /> Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PageLoading() {
  return (
    <div className="flex h-full items-center justify-center" role="status" aria-label="Chargement de la page">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
    </div>
  )
}

/**
 * Structure toute neuve : l'administrateur arrive directement sur l'assistant de démarrage
 * (une fois par session ; « plus tard » le désactive).
 */
function SetupRedirect() {
  const { user } = useMe()
  const navigate = useNavigate()
  const location = useLocation()
  const status = useQuery({
    queryKey: ['setup', 'status'],
    enabled: user.role === Role.Admin,
    queryFn: async () => (await api.get<{ suggested: boolean }>('/setup/status')).data,
  })
  useEffect(() => {
    if (!status.data?.suggested || location.pathname === '/setup') return
    try {
      if (sessionStorage.getItem('setup.opened')) return
      sessionStorage.setItem('setup.opened', '1')
    } catch {
      // Stockage indisponible : on ouvre l'assistant quand même.
    }
    navigate('/setup')
  }, [status.data?.suggested, location.pathname, navigate])
  return null
}

export function AppShell() {
  const { subscription } = useMe()
  const suspended = subscription.status === SubscriptionStatus.Suspended
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = usePersistentState('layout.sidebar.collapsed', false)
  const location = useLocation()
  return (
    <SocketProvider>
      <SetupRedirect />
      <div className="flex h-dvh overflow-hidden">
        <aside className={cn('hidden shrink-0 border-r bg-sidebar transition-[width] duration-200 lg:block', collapsed ? 'w-16' : 'w-60')}>
          <Navigation collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        </aside>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Navigation onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 sm:px-4">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Ouvrir le menu" onClick={() => setMobileOpen(true)}>
              <Menu aria-hidden />
            </Button>
            <div className="flex min-w-0 flex-1 items-center">
              <PendingAlert />
            </div>
            <ConnectionIndicator />
            <NotificationsButton />
            <UserMenu />
          </header>
          <SectionTabs />
          <SosBanner />
          <SubscriptionBanner />
          <main className="min-h-0 flex-1 overflow-y-auto">
            <RouteErrorBoundary key={location.pathname}>
              <Suspense fallback={<PageLoading />}>
                {/* Abonnement suspendu : abonnement, support et documentation restent ouverts. */}
                {suspended && !['/subscription', '/support', '/help'].some((p) => location.pathname.startsWith(p)) ? (
                  <SuspendedScreen />
                ) : (
                  <Outlet />
                )}
              </Suspense>
            </RouteErrorBoundary>
          </main>
        </div>
      </div>
    </SocketProvider>
  )
}
