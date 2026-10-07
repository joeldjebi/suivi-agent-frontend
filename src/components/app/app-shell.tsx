import { Feature, Role, SubscriptionStatus } from '@suivi/shared'
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileClock,
  History,
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
  Receipt,
  Settings,
  Shapes,
  Siren,
  Smartphone,
  Target,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
  BellRing,
} from 'lucide-react'
import { useOpenAlerts } from '@/lib/alerts'
import { SosBanner } from './sos-banner'
import { useOnboarding } from '@/lib/onboarding'
import { useSupportAnswers } from '@/lib/support-queries'
import { Suspense, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
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

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  roles: Role[]
  /** Visible uniquement si la structure utilise les groupes. */
  groupsOnly?: boolean
  /** Fonctionnalité réservée à certaines formules : cadenas si elle n'est pas incluse. */
  feature?: Feature
}

const ADMIN = [Role.Admin]
const STAFF = [Role.Admin, Role.TeamLead]

const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: 'Terrain',
    items: [
      { to: '/map', label: 'Carte en temps réel', icon: MapIcon, roles: STAFF },
      { to: '/alerts', label: 'Alertes', icon: Siren, roles: STAFF },
      { to: '/report', label: 'Bilan du jour', icon: ClipboardList, roles: STAFF },
      { to: '/broadcasts', label: 'Notifications', icon: BellRing, roles: ADMIN, feature: Feature.PushNotifications },
      { to: '/stats', label: 'Statistiques', icon: BarChart3, roles: ADMIN, feature: Feature.Stats },
      { to: '/approvals', label: 'Demandes de zone', icon: ClipboardCheck, roles: STAFF },
      { to: '/history', label: 'Historique des journées', icon: History, roles: STAFF },
      { to: '/missions', label: 'Missions', icon: Target, roles: STAFF, feature: Feature.Missions },
    ],
  },
  {
    title: 'Organisation',
    items: [
      { to: '/zones', label: 'Zones', icon: MapPinned, roles: STAFF },
      { to: '/groups', label: 'Groupes', icon: UsersRound, roles: STAFF, groupsOnly: true, feature: Feature.Groups },
      { to: '/users', label: 'Utilisateurs', icon: Users, roles: STAFF },
      { to: '/team-leads', label: 'Chefs d’équipe', icon: UserCog, roles: ADMIN, feature: Feature.TeamLeads },
      { to: '/pay', label: 'Rémunération', icon: Wallet, roles: STAFF, feature: Feature.Payroll },
      { to: '/mission-types', label: 'Types de missions', icon: Shapes, roles: ADMIN, feature: Feature.Missions },
    ],
  },
  {
    title: 'Aide',
    items: [
      { to: '/help', label: 'Documentation', icon: BookOpen, roles: STAFF },
      { to: '/support', label: 'Support', icon: LifeBuoy, roles: STAFF },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/settings', label: 'Paramètres', icon: Settings, roles: ADMIN },
      { to: '/branding', label: 'Application mobile', icon: Smartphone, roles: ADMIN, feature: Feature.Branding },
      { to: '/billing', label: 'Agents actifs', icon: Receipt, roles: ADMIN },
      { to: '/audit', label: "Journal d'accès", icon: FileClock, roles: ADMIN, feature: Feature.Audit },
      { to: '/subscription', label: 'Abonnement', icon: CreditCard, roles: ADMIN },
    ],
  },
]

function Navigation({ onNavigate, collapsed = false, onToggle }: { onNavigate?: () => void; collapsed?: boolean; onToggle?: () => void }) {
  const { user, tenant, settings, subscription } = useMe()
  const pending = usePendingRequests()
  const alerts = useOpenAlerts(user.role !== Role.Agent).data?.length ?? 0
  const answers = useSupportAnswers()
  return (
    <nav
      aria-label="Navigation principale"
      className={cn('flex h-full flex-col gap-5 overflow-y-auto p-3', collapsed && 'items-center px-2')}
    >
      <div className={cn('flex items-center gap-2 px-2 pt-1', collapsed && 'px-0')}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <MapPinned className="size-4" aria-hidden />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Suivi Agent</p>
            <p className="truncate text-xs text-muted-foreground">{tenant.name}</p>
          </div>
        )}
      </div>
      {user.role === Role.Admin && <OnboardingLink collapsed={collapsed} onNavigate={onNavigate} />}
      {NAV.map((section) => {
        const items = section.items.filter((item) => item.roles.includes(user.role) && (!item.groupsOnly || settings.useGroups))
        if (!items.length) return null
        return (
          <div key={section.title} className="flex w-full flex-col gap-0.5">
            {collapsed ? (
              <span className="mx-auto mb-1 h-px w-6 bg-border" aria-hidden />
            ) : (
              <p className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{section.title}</p>
            )}
            {items.map((item) => {
              const badge = item.to === '/approvals' ? pending : item.to === '/alerts' ? alerts : item.to === '/support' ? answers : 0
              const badgeColor = item.to === '/alerts' ? 'bg-status-alert' : item.to === '/support' ? 'bg-primary' : 'bg-status-paused'
              const link = (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  aria-label={
                    collapsed ? `${item.label}${badge ? `, ${badge} ${item.to === '/alerts' ? 'en cours' : 'en attente'}` : ''}` : undefined
                  }
                  className={({ isActive }) =>
                    cn(
                      'relative flex h-9 items-center gap-2.5 rounded-md px-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground',
                      collapsed && 'justify-center px-0',
                      isActive && 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent',
                    )
                  }
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {!collapsed && item.feature && !subscription.features.includes(item.feature) && (
                    <Lock className="size-3.5 text-muted-foreground" aria-label="Non inclus dans votre formule" />
                  )}
                  {badge > 0 &&
                    (collapsed ? (
                      <span className={cn('absolute top-1 right-1 size-2 rounded-full', badgeColor)} aria-hidden />
                    ) : (
                      <span className={cn('rounded-full px-1.5 text-[11px] leading-5 font-semibold text-white tabular-nums', badgeColor)}>
                        {badge}
                      </span>
                    ))}
                </NavLink>
              )
              return collapsed ? (
                <Tooltip key={item.to}>
                  <TooltipTrigger render={<div />}>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              )
            })}
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

export function AppShell() {
  const { subscription } = useMe()
  const suspended = subscription.status === SubscriptionStatus.Suspended
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = usePersistentState('layout.sidebar.collapsed', false)
  const location = useLocation()
  return (
    <SocketProvider>
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
