import { Loader2 } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { lazyPage } from '@/components/app/route-error'
import { PlatformAuthProvider, usePlatformAuth } from './auth'
import { to } from './config'
import { PlatformLoginPage } from './pages/LoginPage'
import { PlatformShell } from './shell'

const ErrorsPage = lazyPage(() => import('./pages/ErrorsPage').then((m) => ({ default: m.ErrorsPage })))
const DashboardPage = lazyPage(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const TenantsPage = lazyPage(() => import('./pages/TenantsPage').then((m) => ({ default: m.TenantsPage })))
const TenantPage = lazyPage(() => import('./pages/TenantPage').then((m) => ({ default: m.TenantPage })))
const InvoicesPage = lazyPage(() => import('./pages/InvoicesPage').then((m) => ({ default: m.InvoicesPage })))
const PlansPage = lazyPage(() => import('./pages/PlansPage').then((m) => ({ default: m.PlansPage })))
const SettingsPage = lazyPage(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const AdminsPage = lazyPage(() => import('./pages/AdminsPage').then((m) => ({ default: m.AdminsPage })))
const SitePage = lazyPage(() => import('./pages/SitePage').then((m) => ({ default: m.SitePage })))
const LeadsPage = lazyPage(() => import('./pages/LeadsPage').then((m) => ({ default: m.LeadsPage })))
const AccountPage = lazyPage(() => import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })))
const SupportPage = lazyPage(() => import('./pages/SupportPage').then((m) => ({ default: m.SupportPage })))
const DocsPage = lazyPage(() => import('./pages/DocsPage').then((m) => ({ default: m.DocsPage })))
const AppOnboardingPage = lazyPage(() => import('./pages/AppOnboardingPage').then((m) => ({ default: m.AppOnboardingPage })))
const AuditPage = lazyPage(() => import('./pages/AuditPage').then((m) => ({ default: m.AuditPage })))

function Spinner() {
  return (
    <div className="flex h-dvh items-center justify-center" role="status" aria-label="Chargement">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
    </div>
  )
}

function Protected({ children }: { children: ReactNode }) {
  const { admin, loading } = usePlatformAuth()
  const location = useLocation()
  if (loading) return <Spinner />
  if (!admin) return <Navigate to={to('/login')} replace state={{ from: location.pathname }} />
  return <>{children}</>
}

function LoginRoute() {
  const { admin, loading } = usePlatformAuth()
  const location = useLocation()
  if (loading) return <Spinner />
  const from = (location.state as { from?: string } | null)?.from
  return admin ? <Navigate to={from ?? to()} replace /> : <PlatformLoginPage />
}

/**
 * Console de l'éditeur, montée sous son adresse secrète. Les moteurs de recherche ne
 * l'indexent pas, et elle n'est liée nulle part dans l'espace des structures.
 */
export function PlatformApp() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.append(meta)
    const title = document.title
    document.title = 'Console éditeur · Suivi Agent'
    return () => {
      meta.remove()
      document.title = title
    }
  }, [])

  return (
    <PlatformAuthProvider>
      <Routes>
        <Route path="login" element={<LoginRoute />} />
        <Route
          element={
            <Protected>
              <PlatformShell />
            </Protected>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="tenants" element={<TenantsPage />} />
          <Route path="tenants/:id" element={<TenantPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admins" element={<AdminsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="errors" element={<ErrorsPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="site" element={<SitePage />} />
          <Route path="app-onboarding" element={<AppOnboardingPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="documentation" element={<DocsPage />} />
          <Route path="*" element={<Navigate to={to()} replace />} />
        </Route>
      </Routes>
    </PlatformAuthProvider>
  )
}
