import type {
  BillingCycle,
  Feature,
  InvoiceLine,
  InvoiceStatus,
  OnboardingPackage,
  OnboardingRequestStatus,
  PhotoAiProviderChoice,
  PhotoAiProviderId,
  PlanCode,
  SubscriptionStatus,
} from '@suivi/shared'

export interface PlatformAdmin {
  id: string
  email: string
  firstName: string
  lastName: string
  isActive: boolean
  /** Propriétaire : seul à gérer les autres comptes, jamais désactivé ni supprimé */
  isOwner: boolean
  lastLoginAt: string | null
  createdAt: string
  mfaEnabledAt: string | null
  /** Renvoyés par /auth/me */
  mfaEnabled?: boolean
  /** Double authentification obligatoire et pas encore activée : seule sa mise en place est ouverte */
  mfaSetupRequired?: boolean
}

export interface PlatformSession {
  accessToken: string
  expiresIn: number
  admin: PlatformAdmin
  mfaSetupRequired?: boolean
}

/** Première étape réussie : le code de l'application d'authentification est attendu. */
export interface MfaChallenge {
  mfaRequired: true
  mfaToken: string
  expiresIn: number
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface Dashboard {
  currency: string
  tenants: {
    total: number
    trialing: number
    active: number
    pastDue: number
    suspended: number
    newThisMonth: number
    newLastMonth: number
  }
  mrr: number
  arr: number
  byPlan: { planCode: PlanCode; name: string; tenants: number; paying: number; mrr: number }[]
  invoices: {
    pendingAmount: number
    pendingCount: number
    overdueAmount: number
    overdueCount: number
    paidThisMonth: number
    paidLastMonth: number
  }
  months: { month: string; invoiced: number; paid: number; signups: number }[]
  usage: { agents: number; leads: number; activeTenants: number; daysLast30: number }
  trialsEnding: { id: string; name: string; trialEndsAt: string; agents: number }[]
  overdueTenants: { id: string; name: string; status: SubscriptionStatus; invoices: number; amount: number; oldestDueAt: string }[]
  recentTenants: { id: string; name: string; createdAt: string; status: SubscriptionStatus | null; planCode: PlanCode | null }[]
}

export interface TenantRow {
  id: string
  name: string
  createdAt: string
  contactPhone: string | null
  status: SubscriptionStatus | null
  planCode: PlanCode | null
  planName: string | null
  billingCycle: BillingCycle | null
  trialEndsAt: string | null
  manualSuspension: boolean | null
  customTerms: boolean
  mrr: number
  adminEmail: string | null
  adminName: string | null
  adminPhone: string | null
  agents: number
  leads: number
  agentLimit: number | null
  lastActivity: string | null
  overdueAmount: number
}

export interface Plan {
  code: PlanCode
  name: string
  description: string
  monthlyPrice: number
  includedAgents: number
  includedLeads: number
  extraAgentPrice: number
  /** IA photo : photos analysées incluses par mois */
  photoAiMonthlyQuota: number
  /** IA photo : prix d'un lot de 100 photos au-delà du quota */
  photoAiExtraPrice: number
  /** Vente en camion : prix d'un camion actif dans le mois (0 = compris) */
  vanPrice: number
  sort: number
  isActive: boolean
  features: Feature[]
  tenants?: number
  /** Structures payantes (actives ou en retard) */
  paying?: number
  isTrialPlan?: boolean
  isDefaultPlan?: boolean
}

export interface PlanUpdateResult {
  plan: Plan
  added: Feature[]
  removed: Feature[]
  affectedTenants: number
  warnings: string[]
}

export interface Subscription {
  tenantId: string
  planCode: PlanCode
  billingCycle: BillingCycle
  status: SubscriptionStatus
  trialEndsAt: string | null
  commitmentEndsAt: string | null
  extraAgents: number
  suspendedAt: string | null
  customMonthlyPrice: number | null
  customIncludedAgents: number | null
  customIncludedLeads: number | null
  manualSuspension: boolean
  suspensionReason: string | null
  /** Ancien tarif garanti jusqu'à cette date (changement de grille) */
  legacyUntil: string | null
  legacyMonthlyPrice: number | null
  legacyIncludedAgents: number | null
  legacyIncludedLeads: number | null
  legacyExtraAgentPrice: number | null
  legacyPhotoAiQuota: number | null
  legacyNotifiedAt: string | null
  createdAt: string
}

/** Frais ponctuels (mise en place), ajoutés à la prochaine facture. */
export interface OneTimeCharge {
  id: string
  label: string
  amount: number
  packageCode: string | null
  note: string | null
  createdAt: string
  /** Facture qui les porte (null : pas encore facturés) */
  invoiceId: string | null
}

/** Demande de mise en place d'une structure. */
export interface PlatformOnboardingRequest {
  id: string
  tenantId: string
  /** Liste de la console seulement (pas dans la fiche d'une structure) */
  tenantName?: string
  packageCode: string
  packageName: string
  packagePrice: number
  message: string | null
  status: OnboardingRequestStatus
  createdAt: string
  decidedAt: string | null
  decisionNote: string | null
  /** Montant facturé (acceptée) */
  amount: number | null
  chargeId: string | null
  requestedByName?: string | null
  requestedByEmail?: string | null
  requestedByPhone?: string | null
}

/** Mois en cours, ligne par ligne (camions et photos comptés jusqu'à maintenant). */
export interface BillEstimate {
  month: string
  basePrice: number
  extraAgents: number
  extraAgentPrice: number
  discountPercent: number
  prorataPercent: number
  vanCount: number
  vanPrice: number
  photoAiPhotos: number
  photoAiIncluded: number
  photoAiLots: number
  photoAiLotPrice: number
  oneTimeAmount: number
  lines: InvoiceLine[]
  amount: number
}

export interface Invoice {
  id: string
  tenantId: string
  tenantName?: string
  number: string
  month: string
  planCode: PlanCode
  billingCycle: BillingCycle
  agents: number
  basePrice: number
  extraAgents: number
  extraAgentPrice: number
  prorataPercent: number
  discountPercent: number
  amount: number
  currency: string
  status: InvoiceStatus
  issuedAt: string
  dueAt: string
  paidAt: string | null
  paymentReference: string | null
  paymentMethod: string | null
  recordedBy: string | null
  voidReason: string | null
  vanCount: number
  vanPrice: number
  photoAiLots: number
  photoAiLotPrice: number
  oneTimeAmount: number
  /** Détail ligne par ligne (vide pour les factures d'avant la grille de novembre 2026) */
  lines: InvoiceLine[]
  overdue?: boolean
}

export interface Usage {
  agents: { used: number; included: number; extra: number; limit: number }
  leads: { used: number; limit: number }
}

export interface AuditEntry {
  id: string
  action: string
  tenantId?: string | null
  tenantName?: string | null
  details: Record<string, unknown>
  ip?: string | null
  createdAt: string
  adminName: string | null
}

export interface TenantDetail {
  alerts: TenantAlert[]
  tenant: { id: string; name: string; notes: string | null; contactPhone: string | null; createdAt: string }
  subscription: Subscription | null
  plan: Plan | null
  plans: Plan[]
  currency: string
  usage: Usage | null
  estimate: BillEstimate | null
  charges: OneTimeCharge[]
  onboardingRequests: PlatformOnboardingRequest[]
  onboardingPackages: OnboardingPackage[]
  admins: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    isActive: boolean
    createdAt: string
    lastLoginAt: string | null
  }[]
  counts: {
    agents: number
    activeAgents: number
    leads: number
    zones: number
    groups: number
    missions: number
    daysLast30: number
    lastActivity: string | null
  }
  activity: { date: string; days: number }[]
  invoices: Invoice[]
  history: AuditEntry[]
}

export interface PlatformSettings {
  photoAiProvider?: PhotoAiProviderChoice
  currency: string
  trialDays: number
  annualDiscountPercent: number
  invoiceDueDays: number
  suspendAfterDays: number
  trialPlanCode: PlanCode
  defaultPlanCode: PlanCode
  /** App mobile : en dessous, mise à jour obligatoire */
  minAppVersion: string | null
  latestAppVersion: string | null
  /** mineure : bandeau ; recommandée : fenêtre à l'ouverture ; critique : obligatoire */
  appUpdateImportance: 'minor' | 'recommended' | 'critical'
  appReleaseNotes: string | null
  androidStoreUrl: string | null
  iosStoreUrl: string | null
  /** Forfaits de mise en place proposés aux structures */
  onboardingPackages: OnboardingPackage[]
}

export interface TenantAlert {
  level: 'critical' | 'warning' | 'info'
  code: string
  message: string
}

export interface TenantUser {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  role: 'admin' | 'team_lead' | 'agent'
  isActive: boolean
  onProbation: boolean
  createdAt: string
  groupName: string | null
  lastLoginAt: string | null
  lastDay: string | null
  days30: number
  forms30: number
  working: boolean
}

export interface TenantUsers extends Paged<TenantUser> {
  summary: { admins: number; leads: number; agents: number; active: number; inactive: number; working: number; idle30: number }
}

export interface TenantGroup {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  leaderName: string | null
  agents: number
  zones: string[]
  days30: number
}

export interface TenantField {
  zones: {
    id: string
    name: string
    capacity: number | null
    sensitive: boolean
    restricted: boolean
    isActive: boolean
    area: GeoJSON.Polygon
    workingNow: number
    days30: number
  }[]
  daily: { date: string; days: number; agents: number; forms: number }[]
  days: { workingNow: number; days30: number; autoClosed30: number; avgHours30: number }
  missions: { active: number; achieved: number; late: number; types: number; forms30: number; rejected30: number }
  recentMissions: {
    id: string
    title: string
    status: string
    dueDate: string | null
    isActive: boolean
    typeName: string
    assignee: string | null
    submissions: number
  }[]
}

export interface PhotoAiUsageInfo {
  month: string
  quota: number
  bonus: number
  used: number
  remaining: number
  auto: boolean
  configured: boolean
}

/** IA photo côté éditeur : fournisseurs branchés, choix actif, analyses et coût du mois. */
export interface PhotoAiOverview {
  choice: PhotoAiProviderChoice
  providers: { id: PhotoAiProviderId; label: string; configured: boolean; model: string | null }[]
  month: string
  usage: { provider: string; analyses: number; costUsd: number }[]
}

export interface TenantConfig {
  photoAi?: PhotoAiUsageInfo
  settings: Record<string, unknown> & {
    useGroups: boolean
    approvalMode: string
    zoneRequired: boolean
    timezone: string
    dailyResetTime: string
    trackDuringPause: boolean
    autoEndDayAtReset: boolean
    signalLostMinutes: number
    zoneExitToleranceMeters: number
    zoneExitAlertMinutes: number
    positionRetentionDays: number
    requestExpirationMinutes: number
    allowZoneChangeBeforeStart: boolean
    startWhilePending: boolean
    zoneAccessWithoutGroups: string
    updatedAt: string
  }
  effective: { useGroups: boolean; approvalMode: string } | null
  features: { feature: Feature; included: boolean; usage: string | null }[]
  branding: {
    displayName: string | null
    primaryColor: string
    welcomeMessage: string | null
    supportPhone: string | null
    hasLogo: boolean
    version: number
    updatedAt: string
  } | null
  payroll: { period: string | null; grids: number; runs: number }
}

export interface TenantLog {
  id: string
  action: string
  method: string | null
  path: string | null
  statusCode: number | null
  ip: string | null
  createdAt: string
  userName: string | null
  userRole: string | null
}
