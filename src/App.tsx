import { Feature, Role } from '@suivi/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { FeatureGate } from '@/components/app/feature-gate'
import { lazyPage } from '@/components/app/route-error'
import { EmptyState, Page } from '@/components/app/page'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/lib/auth'
import { Compass } from 'lucide-react'
import { PLATFORM_PATH } from '@/platform/config'

// Chaque écran est chargé à la demande : premier affichage plus rapide sur réseau mobile
// (le site vitrine ne charge ni l'espace connecté, ni la connexion).
const AppShell = lazyPage(() => import('@/components/app/app-shell').then((m) => ({ default: m.AppShell })))
const AgentNotice = lazyPage(() => import('@/features/auth/AgentNotice').then((m) => ({ default: m.AgentNotice })))
const LoginPage = lazyPage(() => import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazyPage(() => import('@/features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const PrivacyPage = lazyPage(() => import('@/landing/LegalPages').then((m) => ({ default: m.PrivacyPage })))
const PublicSupportPage = lazyPage(() => import('@/landing/LegalPages').then((m) => ({ default: m.SupportPage })))
const DownloadPage = lazyPage(() => import('@/landing/DownloadPage').then((m) => ({ default: m.DownloadPage })))
const AccountDeletionPage = lazyPage(() => import('@/landing/LegalPages').then((m) => ({ default: m.AccountDeletionPage })))
const AuditPage = lazyPage(() => import('@/features/admin/AuditPage').then((m) => ({ default: m.AuditPage })))
const BillingPage = lazyPage(() => import('@/features/admin/BillingPage').then((m) => ({ default: m.BillingPage })))
const ApprovalsPage = lazyPage(() => import('@/features/approvals/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })))
const GroupsPage = lazyPage(() => import('@/features/groups/GroupsPage').then((m) => ({ default: m.GroupsPage })))
const HelpPage = lazyPage(() => import('@/features/help/HelpPage').then((m) => ({ default: m.HelpPage })))
const SupportPage = lazyPage(() => import('@/features/support/SupportPage').then((m) => ({ default: m.SupportPage })))
const TicketPage = lazyPage(() => import('@/features/support/TicketPage').then((m) => ({ default: m.TicketPage })))
const SetupWizard = lazyPage(() => import('@/features/setup/SetupWizard').then((m) => ({ default: m.SetupWizard })))
const OnboardingPage = lazyPage(() => import('@/features/onboarding/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))
const ReportPage = lazyPage(() => import('@/features/report/ReportPage').then((m) => ({ default: m.ReportPage })))
const AlertsPage = lazyPage(() => import('@/features/alerts/AlertsPage').then((m) => ({ default: m.AlertsPage })))
const HistoryPage = lazyPage(() => import('@/features/history/HistoryPage').then((m) => ({ default: m.HistoryPage })))
const LiveMapPage = lazyPage(() => import('@/features/map/LiveMapPage').then((m) => ({ default: m.LiveMapPage })))
const MissionDetailPage = lazyPage(() => import('@/features/missions/MissionDetailPage').then((m) => ({ default: m.MissionDetailPage })))
const MissionsPage = lazyPage(() => import('@/features/missions/MissionsPage').then((m) => ({ default: m.MissionsPage })))
const MissionTypesPage = lazyPage(() => import('@/features/missions/MissionTypesPage').then((m) => ({ default: m.MissionTypesPage })))
const SettingsPage = lazyPage(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const UsersPage = lazyPage(() => import('@/features/users/UsersPage').then((m) => ({ default: m.UsersPage })))
const BrandingPage = lazyPage(() => import('@/features/branding/BrandingPage').then((m) => ({ default: m.BrandingPage })))
const PayrollPage = lazyPage(() => import('@/features/payroll/PayrollPage').then((m) => ({ default: m.PayrollPage })))
const PayRunPage = lazyPage(() => import('@/features/payroll/PayRunPage').then((m) => ({ default: m.PayRunPage })))
const BroadcastsPage = lazyPage(() => import('@/features/broadcasts/BroadcastsPage').then((m) => ({ default: m.BroadcastsPage })))
const StatsPage = lazyPage(() => import('@/features/stats/StatsPage').then((m) => ({ default: m.StatsPage })))
const SubscriptionPage = lazyPage(() => import('@/features/subscription/SubscriptionPage').then((m) => ({ default: m.SubscriptionPage })))
const TeamLeadsPage = lazyPage(() => import('@/features/team-leads/TeamLeadsPage').then((m) => ({ default: m.TeamLeadsPage })))
const TeamLeadDetailPage = lazyPage(() =>
  import('@/features/team-leads/TeamLeadDetailPage').then((m) => ({ default: m.TeamLeadDetailPage })),
)
// Console éditeur : chargée seulement sous son adresse secrète.
const PlatformApp = lazyPage(() => import('@/platform/PlatformApp').then((m) => ({ default: m.PlatformApp })))
const LandingPage = lazyPage(() => import('@/landing/LandingPage').then((m) => ({ default: m.LandingPage })))
const ZonesPage = lazyPage(() => import('@/features/zones/ZonesPage').then((m) => ({ default: m.ZonesPage })))
const ProductInsightsPage = lazyPage(() =>
  import('@/features/products/ProductInsightsPage').then((m) => ({ default: m.ProductInsightsPage })),
)
const ProductsPage = lazyPage(() => import('@/features/products/ProductsPage').then((m) => ({ default: m.ProductsPage })))
const FormStatsPage = lazyPage(() => import('@/features/form-stats/FormStatsPage').then((m) => ({ default: m.FormStatsPage })))
const OrdersPage = lazyPage(() => import('@/features/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })))
const PricesPage = lazyPage(() => import('@/features/orders/PricesPage').then((m) => ({ default: m.PricesPage })))
const OutletsPage = lazyPage(() => import('@/features/outlets/OutletsPage').then((m) => ({ default: m.OutletsPage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, error) => count < 2 && (error as { response?: { status: number } }).response?.status !== 403,
    },
  },
})

function FullPageSpinner() {
  return (
    <div className="flex h-dvh items-center justify-center" role="status" aria-label="Chargement">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
    </div>
  )
}

/** Réservé aux utilisateurs connectés ; les agents sont redirigés vers l'app mobile. */
function Protected({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSpinner />
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (me.user.role === Role.Agent) return <AgentNotice />
  return <>{children}</>
}

function RoleRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { me } = useAuth()
  if (!me || !roles.includes(me.user.role)) return <Navigate to="/map" replace />
  return <>{children}</>
}

/**
 * Pages accessibles sans être connecté. Une fois connecté, on rejoint la page
 * demandée avant la connexion, sinon `redirectTo`. C'est le seul endroit qui redirige :
 * les formulaires de connexion et d'inscription ne naviguent pas eux-mêmes.
 */
function PublicOnly({ children, redirectTo = '/map' }: { children: ReactNode; redirectTo?: string }) {
  const { me, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSpinner />
  const from = (location.state as { from?: string } | null)?.from
  return me ? <Navigate to={from ?? redirectTo} replace /> : <>{children}</>
}

function NotFound() {
  return (
    <Page>
      <EmptyState icon={Compass} title="Page introuvable" description="Cette adresse n'existe pas ou a été déplacée." />
    </Page>
  )
}

const admin = [Role.Admin]
const staff = [Role.Admin, Role.TeamLead]

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            {PLATFORM_PATH && (
              <Route
                path={`${PLATFORM_PATH}/*`}
                element={
                  <Suspense fallback={<FullPageSpinner />}>
                    <PlatformApp />
                  </Suspense>
                }
              />
            )}
            <Route path="*" element={<TenantApp />} />
          </Routes>
          <Toaster />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

/** Espace des structures (administrateurs et chefs d'équipe). */
function TenantApp() {
  return (
    <AuthProvider>
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          {/* Site vitrine, ouvert à tous (contenu réglé depuis la console éditeur). */}
          <Route
            index
            element={
              <Suspense fallback={<FullPageSpinner />}>
                <LandingPage />
              </Suspense>
            }
          />
          {/* Pages légales publiques (liens déclarés sur l'App Store et Google Play). */}
          <Route
            path="/confidentialite"
            element={
              <Suspense fallback={<FullPageSpinner />}>
                <PrivacyPage />
              </Suspense>
            }
          />
          <Route path="/telecharger" element={<DownloadPage />} />
          <Route
            path="/assistance"
            element={
              <Suspense fallback={<FullPageSpinner />}>
                <PublicSupportPage />
              </Suspense>
            }
          />
          <Route
            path="/suppression-compte"
            element={
              <Suspense fallback={<FullPageSpinner />}>
                <AccountDeletionPage />
              </Suspense>
            }
          />
          <Route
            path="/login"
            element={
              <PublicOnly>
                <LoginPage />
              </PublicOnly>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnly redirectTo="/start">
                <RegisterPage />
              </PublicOnly>
            }
          />
          <Route
            element={
              <Protected>
                <AppShell />
              </Protected>
            }
          >
            <Route path="map" element={<LiveMapPage />} />
            <Route path="approvals" element={<ApprovalsPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="report" element={<ReportPage />} />
            <Route path="help" element={<HelpPage />} />
            <Route path="help/:slug" element={<HelpPage />} />
            <Route path="support" element={<SupportPage />} />
            <Route path="support/:id" element={<TicketPage />} />
            <Route
              path="missions"
              element={
                <FeatureGate feature={Feature.Missions}>
                  <MissionsPage />
                </FeatureGate>
              }
            />
            <Route
              path="missions/:id"
              element={
                <FeatureGate feature={Feature.Missions}>
                  <MissionDetailPage />
                </FeatureGate>
              }
            />
            <Route path="zones" element={<ZonesPage />} />
            <Route
              path="outlets"
              element={
                <FeatureGate feature={Feature.PointsOfSale}>
                  <OutletsPage />
                </FeatureGate>
              }
            />
            <Route
              path="product-insights"
              element={
                <FeatureGate feature={Feature.ProductAudits}>
                  <ProductInsightsPage />
                </FeatureGate>
              }
            />
            <Route
              path="products"
              element={
                <FeatureGate feature={[Feature.ProductAudits, Feature.Orders]}>
                  <ProductsPage />
                </FeatureGate>
              }
            />
            <Route
              path="form-stats"
              element={
                <RoleRoute roles={staff}>
                  <FeatureGate feature={[Feature.Missions, Feature.PointsOfSale]}>
                    <FormStatsPage />
                  </FeatureGate>
                </RoleRoute>
              }
            />
            <Route
              path="orders"
              element={
                <FeatureGate feature={Feature.Orders}>
                  <OrdersPage />
                </FeatureGate>
              }
            />
            <Route
              path="prices"
              element={
                <RoleRoute roles={admin}>
                  <FeatureGate feature={Feature.Orders}>
                    <PricesPage />
                  </FeatureGate>
                </RoleRoute>
              }
            />
            <Route
              path="setup"
              element={
                <RoleRoute roles={admin}>
                  <SetupWizard />
                </RoleRoute>
              }
            />
            <Route
              path="groups"
              element={
                <FeatureGate feature={Feature.Groups}>
                  <GroupsPage />
                </FeatureGate>
              }
            />
            <Route path="users" element={<UsersPage />} />
            <Route
              path="stats"
              element={
                <RoleRoute roles={admin}>
                  <FeatureGate feature={Feature.Stats}>
                    <StatsPage />
                  </FeatureGate>
                </RoleRoute>
              }
            />
            <Route
              path="broadcasts"
              element={
                <RoleRoute roles={admin}>
                  <FeatureGate feature={Feature.PushNotifications}>
                    <BroadcastsPage />
                  </FeatureGate>
                </RoleRoute>
              }
            />
            <Route
              path="team-leads"
              element={
                <RoleRoute roles={admin}>
                  <FeatureGate feature={Feature.TeamLeads}>
                    <TeamLeadsPage />
                  </FeatureGate>
                </RoleRoute>
              }
            />
            <Route
              path="team-leads/:id"
              element={
                <RoleRoute roles={admin}>
                  <FeatureGate feature={Feature.TeamLeads}>
                    <TeamLeadDetailPage />
                  </FeatureGate>
                </RoleRoute>
              }
            />
            <Route
              path="mission-types"
              element={
                <RoleRoute roles={admin}>
                  <FeatureGate feature={[Feature.Missions, Feature.PointsOfSale]}>
                    <MissionTypesPage />
                  </FeatureGate>
                </RoleRoute>
              }
            />
            {/* Les mêmes formulaires, depuis la rubrique Points de vente. */}
            <Route
              path="visit-forms"
              element={
                <RoleRoute roles={admin}>
                  <FeatureGate feature={Feature.PointsOfSale}>
                    <MissionTypesPage visits />
                  </FeatureGate>
                </RoleRoute>
              }
            />
            <Route
              path="start"
              element={
                <RoleRoute roles={admin}>
                  <OnboardingPage />
                </RoleRoute>
              }
            />
            <Route
              path="settings"
              element={
                <RoleRoute roles={admin}>
                  <SettingsPage />
                </RoleRoute>
              }
            />
            <Route
              path="branding"
              element={
                <RoleRoute roles={admin}>
                  <FeatureGate feature={Feature.Branding}>
                    <BrandingPage />
                  </FeatureGate>
                </RoleRoute>
              }
            />
            <Route
              path="billing"
              element={
                <RoleRoute roles={admin}>
                  <BillingPage />
                </RoleRoute>
              }
            />
            <Route
              path="audit"
              element={
                <RoleRoute roles={admin}>
                  <FeatureGate feature={Feature.Audit}>
                    <AuditPage />
                  </FeatureGate>
                </RoleRoute>
              }
            />
            <Route
              path="pay"
              element={
                <RoleRoute roles={staff}>
                  <FeatureGate feature={Feature.Payroll}>
                    <PayrollPage />
                  </FeatureGate>
                </RoleRoute>
              }
            />
            <Route
              path="pay/runs/:id"
              element={
                <RoleRoute roles={staff}>
                  <FeatureGate feature={Feature.Payroll}>
                    <PayRunPage />
                  </FeatureGate>
                </RoleRoute>
              }
            />
            <Route
              path="subscription"
              element={
                <RoleRoute roles={admin}>
                  <SubscriptionPage />
                </RoleRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
