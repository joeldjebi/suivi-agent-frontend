import { useQuery } from '@tanstack/react-query'
import { LogoMark } from '@/components/app/logo'
import {
  Building2,
  Globe,
  Smartphone,
  Inbox,
  FileClock,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  UserCog,
  type LucideIcon,
  LifeBuoy,
  BookOpen,
  Bug,
} from 'lucide-react'
import { Suspense, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { RouteErrorBoundary } from '@/components/app/route-error'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { errorMessage } from '@/lib/api'
import { fullName, initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { usePlatformAdmin, usePlatformAuth } from './auth'
import { platformApi } from './api'
import { to } from './config'
import { MfaCard } from './mfa'

const NAV: { title: string; items: { to: string; label: string; icon: LucideIcon; end?: boolean }[] }[] = [
  {
    title: 'Clients',
    items: [
      { to: '', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      { to: '/tenants', label: 'Structures', icon: Building2 },
      { to: '/invoices', label: 'Factures', icon: Receipt },
    ],
  },
  {
    title: 'Assistance',
    items: [
      { to: '/support', label: 'Support', icon: LifeBuoy },
      { to: '/documentation', label: 'Documentation', icon: BookOpen },
    ],
  },
  {
    title: 'Site vitrine',
    items: [
      { to: '/site', label: 'Contenu du site', icon: Globe },
      { to: '/app-onboarding', label: 'Onboarding de l’app', icon: Smartphone },
      { to: '/leads', label: 'Demandes de démo', icon: Inbox },
    ],
  },
  {
    title: 'Offre',
    items: [
      { to: '/plans', label: 'Formules', icon: Package },
      { to: '/settings', label: 'Réglages', icon: Settings },
    ],
  },
  {
    title: 'Santé et sécurité',
    items: [
      { to: '/errors', label: 'Erreurs', icon: Bug },
      { to: '/admins', label: 'Comptes éditeur', icon: UserCog },
      { to: '/audit', label: 'Journal', icon: FileClock },
    ],
  },
]

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  // Demandes d'aide en attente d'une réponse (pastille du menu).
  const support = useQuery({
    queryKey: ['platform', 'support', 'open-count'],
    queryFn: async () => (await platformApi.get<{ open: number }>('/support', { params: { status: 'open' } })).data.open,
    refetchInterval: 60_000,
  })
  // Erreurs à traiter (pastille du menu).
  const errors = useQuery({
    queryKey: ['platform', 'errors', 'summary'],
    queryFn: async () => (await platformApi.get<{ open: number }>('/errors/summary')).data.open,
    refetchInterval: 60_000,
  })
  return (
    <nav aria-label="Navigation de la console" className="flex h-full flex-col gap-5 overflow-y-auto p-3">
      <div className="flex items-center gap-2 px-2 pt-1">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
          <LogoMark className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">Suivi Agent</p>
          <p className="truncate text-xs text-slate-400">Console éditeur</p>
        </div>
      </div>
      {NAV.map((section) => (
        <div key={section.title} className="flex flex-col gap-0.5">
          <p className="px-2 pb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">{section.title}</p>
          {section.items.map((item) => (
            <NavLink
              key={item.to}
              to={to(item.to)}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex h-9 items-center gap-2.5 rounded-md px-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white',
                  isActive && 'bg-white/10 text-white hover:bg-white/10',
                )
              }
            >
              <item.icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate">{item.label}</span>
              {item.to === '/support' && !!support.data && (
                <span className="rounded-full bg-amber-500 px-1.5 text-[11px] leading-5 font-semibold text-white tabular-nums">
                  {support.data}
                </span>
              )}
              {item.to === '/errors' && !!errors.data && (
                <span className="rounded-full bg-red-600 px-1.5 text-[11px] leading-5 font-semibold text-white tabular-nums">
                  {errors.data}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}

function PasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { changePassword } = usePlatformAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const mismatch = confirm !== '' && confirm !== next
  const close = () => {
    setCurrent('')
    setNext('')
    setConfirm('')
    onClose()
  }
  const submit = async () => {
    setSaving(true)
    try {
      await changePassword(current, next)
      toast.success('Mot de passe modifié : vos autres sessions sont fermées')
      close()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Changer de mot de passe</DialogTitle>
          <DialogDescription>Au moins 10 caractères. Vos autres sessions ouvertes seront fermées.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pw-current">Mot de passe actuel</Label>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pw-next">Nouveau mot de passe</Label>
            <Input id="pw-next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pw-confirm">Confirmation</Label>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              aria-invalid={mismatch}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {mismatch && <p className="text-xs text-destructive">Les deux mots de passe ne correspondent pas.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Annuler
          </Button>
          <Button disabled={!current || next.length < 10 || next !== confirm || saving} onClick={() => void submit()}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AdminMenu() {
  const admin = usePlatformAdmin()
  const { logout } = usePlatformAuth()
  const [password, setPassword] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Menu du compte" />}>
          <span className="flex size-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {initials(admin)}
          </span>
          <span className="hidden text-left text-sm md:block">{fullName(admin)}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <p className="font-medium">{fullName(admin)}</p>
              <p className="text-xs font-normal text-muted-foreground">Éditeur · {admin.email}</p>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link to={to('/account')} />}>
            <ShieldCheck aria-hidden /> Sécurité du compte
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPassword(true)}>
            <KeyRound aria-hidden /> Changer de mot de passe
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void logout()}>
            <LogOut aria-hidden /> Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PasswordDialog open={password} onClose={() => setPassword(false)} />
    </>
  )
}

/** Double authentification obligatoire et pas encore activée : seule sa mise en place est proposée. */
function MfaRequired() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Protégez votre compte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          La double authentification est obligatoire pour accéder à la console éditeur. Activez-la pour continuer.
        </p>
      </div>
      <MfaCard />
    </div>
  )
}

export function PlatformShell() {
  const admin = usePlatformAdmin()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden w-60 shrink-0 bg-slate-950 lg:block">
        <Navigation />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 border-0 bg-slate-950 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Navigation onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 sm:px-4">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Ouvrir le menu" onClick={() => setMobileOpen(true)}>
            <Menu aria-hidden />
          </Button>
          <div className="flex-1" />
          <span className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
            <ShieldCheck className="size-3.5" aria-hidden /> Accès éditeur
          </span>
          <AdminMenu />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-background">
          <RouteErrorBoundary key={location.pathname}>
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center" role="status" aria-label="Chargement de la page">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
                </div>
              }
            >
              {admin.mfaSetupRequired ? <MfaRequired /> : <Outlet />}
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  )
}
