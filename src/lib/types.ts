import type {
  AdjustmentStatus,
  AlertType,
  ApprovalMode,
  BillingCycle,
  DayEndReason,
  DayStatus,
  ExpirationAction,
  Feature,
  InvoiceStatus,
  MissionField,
  MissionPay,
  MissionStatus,
  PayGridComponents,
  PayGridTargets,
  PayPeriod,
  PayRunStatus,
  PlanCode,
  ProgressMethod,
  Role,
  SubmissionStatus,
  SubscriptionStatus,
  ZoneAccessWithoutGroups,
  ZoneExitInfo,
  ZoneRequestStatus,
} from '@suivi/shared'
import type { Polygon } from 'geojson'

/** Réponses de l'API (voir Swagger : /api/docs). */

export interface Page<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface User {
  id: string
  tenantId: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  role: Role
  groupId: string | null
  onProbation: boolean
  isActive: boolean
  createdAt: string
  /** Activité, renvoyée par la liste des utilisateurs */
  lastDay?: string | null
  days30?: number
  working?: boolean
  lastLoginAt?: string | null
}

export interface UserStats {
  agents: number
  teamLeads: number
  admins: number
  active: number
  inactive: number
  probation: number
  withoutGroup: number
  working: number
  never: number
  idle30: number
  createdThisMonth: number
  /** Quotas de la formule (administrateur seulement) */
  quota: QuotaUsage | null
}

export interface Tenant {
  id: string
  name: string
}

export interface MixedCriteria {
  sensitiveZone: boolean
  fillThresholdPercent: number | null
  zoneChange: boolean
  probationAgent: boolean
}

export interface Settings {
  tenantId: string
  useGroups: boolean
  zoneAccessWithoutGroups: ZoneAccessWithoutGroups
  zoneRequired: boolean
  approvalMode: ApprovalMode
  mixedCriteria: MixedCriteria
  requestExpirationMinutes: number
  expirationActionManual: ExpirationAction
  expirationActionMixed: ExpirationAction
  allowZoneChangeBeforeStart: boolean
  startWhilePending: boolean
  dailyResetTime: string
  timezone: string
  trackDuringPause: boolean
  autoEndDayAtReset: boolean
  signalLostMinutes: number
  zoneExitToleranceMeters: number
  zoneExitAlertMinutes: number
  /** Alertes des responsables */
  alertStartTime: string | null
  alertLateMinutes: number
  alertWorkdays: number[]
  alertImmobileMinutes: number | null
  alertImmobileRadiusM: number
  alertBatteryPercent: number | null
  alertSignalLost: boolean
  alertMocked: boolean
  /** Formulaires acceptés seulement pendant une journée dans une zone de la mission */
  submissionRequiresDay: boolean
  /** Heure du bilan de fin de journée envoyé aux responsables ; null : pas d'envoi */
  dailyReportTime: string | null
  positionRetentionDays: number
}

export interface Me {
  user: User
  tenant: Tenant
  settings: Settings
  subscription: SubscriptionSummary
}

export interface SubscriptionSummary {
  status: SubscriptionStatus
  planCode: PlanCode
  planName: string
  billingCycle: BillingCycle
  trialEndsAt: string | null
  /** Fonctionnalités ouvertes maintenant (toutes pendant l'essai, aucune si suspendu) */
  features: Feature[]
  /** Formule la moins chère qui inclut chaque fonctionnalité absente */
  upgrades: Partial<Record<Feature, { code: PlanCode; name: string }>>
}

export interface Plan {
  code: PlanCode
  name: string
  description: string
  /** Forfait mensuel */
  monthlyPrice: number
  includedAgents: number
  includedLeads: number
  /** Prix mensuel d'un agent au-delà du quota */
  extraAgentPrice: number
  sort: number
  features: Feature[]
}

export interface QuotaUsage {
  agents: { used: number; included: number; extra: number; limit: number }
  leads: { used: number; limit: number }
}

export interface Invoice {
  id: string
  number: string
  month: string
  planCode: PlanCode
  billingCycle: BillingCycle
  /** Agents actifs le jour de la facture */
  agents: number
  basePrice: number
  extraAgents: number
  extraAgentPrice: number
  discountPercent: number
  prorataPercent: number
  amount: number
  currency: string
  status: InvoiceStatus
  issuedAt: string
  dueAt: string
  paidAt: string | null
  paymentReference: string | null
}

export interface SubscriptionDetails {
  subscription: {
    planCode: PlanCode
    billingCycle: BillingCycle
    status: SubscriptionStatus
    trialEndsAt: string | null
    commitmentEndsAt: string | null
    extraAgents: number
    suspendedAt: string | null
    createdAt: string
  }
  plan: Plan
  plans: Plan[]
  currency: string
  annualDiscountPercent: number
  trialDaysLeft: number | null
  features: Feature[]
  estimate: {
    month: string
    basePrice: number
    extraAgents: number
    extraAgentPrice: number
    discountPercent: number
    prorataPercent: number
    amount: number
  }
  usage: QuotaUsage
  unpaid: { count: number; amount: number }
}

export interface Tokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface Group {
  id: string
  name: string
  leaderId: string | null
  isActive: boolean
  agentCount?: number
}

export interface GroupDetail extends Group {
  members: User[]
  zones: Zone[]
}

export interface Zone {
  id: string
  name: string
  area: Polygon
  capacity: number | null
  sensitive: boolean
  restricted: boolean
  isActive: boolean
  taken: number
  placesLeft: number | null
  isFull: boolean
  /** Groupes actifs de la zone ; vide : zone libre, ouverte à tous */
  groupIds?: string[]
}

export interface ZoneRequest {
  id: string
  agentId: string
  zoneId: string
  status: ZoneRequestStatus
  isChange: boolean
  requiresApproval: boolean
  workDate: string
  expiresAt: string | null
  decidedById: string | null
  decidedAt: string | null
  decisionReason: string | null
  releasedAt: string | null
  releaseReason: string | null
  createdAt: string
  agent: User
  zone: Zone
}

export interface DayPause {
  id: string
  startedAt: string
  endedAt: string | null
}

export interface WorkDay {
  id: string
  agentId: string
  zoneId: string | null
  status: DayStatus
  workDate: string
  startedAt: string
  endedAt: string | null
  endReason: DayEndReason | null
  pauses: DayPause[]
  workedSeconds: number
  pausedSeconds: number
  agent?: User
}

export interface LivePosition {
  agentId: string
  dayId: string
  zoneId: string | null
  status: DayStatus
  lat: number
  lng: number
  accuracy: number
  batteryLevel: number | null
  isMocked: boolean
  outsideZone: boolean
  recordedAt: string
  receivedAt: string
}

export interface LiveAgent {
  dayId: string
  agent: Pick<User, 'id' | 'firstName' | 'lastName' | 'groupId'>
  status: DayStatus
  zoneId: string | null
  startedAt: string
  position: LivePosition | null
  signalLost: boolean
  /** Sortie de zone en cours (avec la tolérance de la structure) */
  zoneExit: ZoneExitInfo | null
  /** Alertes en cours (immobile, batterie faible…) */
  alerts: AlertType[]
}

export interface TrackPoint {
  lat: number
  lng: number
  accuracy: number
  speed: number | null
  batteryLevel: number | null
  isMocked: boolean
  outsideZone: boolean | null
  recordedAt: string
}

export interface MissionType {
  id: string
  name: string
  description: string | null
  fields: MissionField[]
  isActive: boolean
  /** Le type a ses propres conditions de rémunération */
  hasPay?: boolean
  /** Conditions de rémunération du type : administrateur seulement */
  pay?: MissionPay | null
}

export interface Progress {
  current: number
  target: number
  percent: number
}

export interface Mission {
  id: string
  typeId: string
  title: string
  description: string | null
  assigneeAgentId: string | null
  assigneeGroupId: string | null
  progressMethod: ProgressMethod
  targetValue: number
  sumFieldKey: string | null
  dueDate: string | null
  status: MissionStatus
  isActive: boolean
  createdAt: string
  progress: Progress
  /** Zones où la mission se fait */
  zones?: { id: string; name: string }[]
  /** Rémunération propre (remplace la grille de l'agent pour cette mission) */
  hasOwnPay: boolean
  /** Conditions propres : administrateur seulement */
  pay?: MissionPay | null
}

export interface MissionDetail extends Mission {
  type: MissionType
  contributions: { agentId: string; firstName: string; lastName: string; value: number }[]
}

export interface Submission {
  id: string
  missionId: string
  agentId: string
  data: Record<string, unknown>
  submittedAt: string
  status: SubmissionStatus
  rejectedReason: string | null
  /** Journée pendant laquelle il a été saisi (null : hors journée) */
  dayId?: string | null
  /** Saisi hors des zones de la mission, ou position hors du périmètre */
  outOfZone?: boolean
  agent: User
}

export interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  data: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

export interface AuditLog {
  id: string
  userId: string | null
  action: string
  method: string | null
  path: string | null
  statusCode: number | null
  ip: string | null
  createdAt: string
}

export interface BillingAgent {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  email: string
  isActive: boolean
  groupId: string | null
  groupName: string | null
  days: number
  /** Temps travaillé dans le mois, pauses déduites (secondes) */
  workedSeconds: number
  firstDay: string
  lastDay: string
  mainZone: string | null
  zones: number
  forms: number
  rejectedForms: number
  /** Journées clôturées automatiquement (non terminées par l'agent) */
  autoClosedDays: number
}

export interface ActiveAgents {
  month: string
  /** Agents actifs du mois, indépendant des filtres */
  activeAgents: number
  previous: { month: string; activeAgents: number }
  /** Totaux des agents affichés */
  shown: { agents: number; days: number; workedSeconds: number; forms: number }
  agents: BillingAgent[]
}

export interface Branding {
  displayName: string
  primaryColor: string
  onPrimaryColor: string
  welcomeMessage: string | null
  supportPhone: string | null
  logoUrl: string | null
  version: number
}

export interface LeadStats {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  isActive: boolean
  avatarVersion: number | null
  groups: { id: string; name: string }[]
  agents: number
  /** Demandes qui attendaient sa validation, reçues sur la période */
  requestsReceived: number
  requestsDecided: number
  requestsRejected: number
  avgResponseSeconds: number | null
  /** Expirées ou validées automatiquement faute de réponse */
  requestsUnanswered: number
  requestsPending: number
  reassignments: number
  formsRejected: number
  missionsCreated: number
  logins: number
  loginDays: number
  lastLoginAt: string | null
  lastActivityAt: string | null
  teamDays: number
  teamActiveAgents: number
}

export interface LeadPeriod {
  from: string
  to: string
  timezone: string
}

export interface TeamLeadsOverview extends LeadPeriod {
  leads: LeadStats[]
}

export interface TeamLeadDetail extends LeadPeriod {
  lead: LeadStats
  agents: { id: string; firstName: string; lastName: string; groupName: string; days: number; lastDay: string | null }[]
}

export type TimelineType =
  | 'login'
  | 'zone.approved'
  | 'zone.rejected'
  | 'zone.reassigned'
  | 'zone.unanswered'
  | 'submission.rejected'
  | 'mission.created'
  | 'mission.result'

export interface TimelineEvent {
  type: TimelineType
  at: string
  agent: { id: string; name: string } | null
  zone: string | null
  mission: { id: string; title: string } | null
  detail: string | null
  responseSeconds: number | null
}

export interface LeadTimeline extends LeadPeriod {
  items: TimelineEvent[]
  total: number
  page: number
  limit: number
}

export interface StatsOverview {
  from: string
  to: string
  previous: { from: string; to: string }
  kpis: {
    activeAgents: number
    totalAgents: number
    days: number
    workedSeconds: number
    forms: number
    formsRejected: number
    distanceKm: number
    /** Heure moyenne de début, en minutes depuis minuit */
    avgStartMinutes: number | null
    autoClosedDays: number
    positions: number
    outsidePositions: number
    mockedPositions: number
    requests: {
      total: number
      needingApproval: number
      decided: number
      rejected: number
      unanswered: number
      avgResponseSeconds: number | null
    }
    missions: { open: number; achieved: number; failed: number }
  }
  previousKpis: { activeAgents: number; days: number; workedSeconds: number; forms: number; formsRejected: number; distanceKm: number }
  daily: { date: string; activeAgents: number; days: number; workedSeconds: number; forms: number }[]
  weekdays: { weekday: number; days: number; workedSeconds: number }[]
  startHours: { hour: number; days: number }[]
  groups: {
    id: string
    name: string
    agents: number
    activeAgents: number
    days: number
    workedSeconds: number
    forms: number
    formsRejected: number
    avgResponseSeconds: number | null
  }[]
  zones: {
    id: string
    name: string
    capacity: number | null
    days: number
    agents: number
    workedSeconds: number
    occupancy: number | null
  }[]
  agents: {
    id: string
    firstName: string
    lastName: string
    groupName: string | null
    days: number
    workedSeconds: number
    forms: number
    formsRejected: number
    distanceKm: number
    autoClosedDays: number
  }[]
  openMissions: {
    id: string
    title: string
    status: string
    dueDate: string | null
    progress: { current: number; target: number; percent: number }
  }[]
}

export interface PayItem {
  code: string
  label: string
  quantity: number | null
  unitAmount: number | null
  amount: number
}

export interface PayGrid {
  id: string
  name: string
  components: PayGridComponents
  targets: PayGridTargets
  isActive: boolean
  updatedAt: string
}

export interface PayEstimateLine {
  user: { id: string; firstName: string; lastName: string; role: Role; phone: string | null }
  gridId: string | null
  gridName: string | null
  items: PayItem[]
  gross: number
}

export interface PayEstimate {
  period: PayPeriod
  start: string
  end: string
  label: string
  currency: string
  lines: PayEstimateLine[]
  total: number
}

export interface PayRunSummary {
  id: string
  period: PayPeriod
  periodStart: string
  periodEnd: string
  label: string
  status: PayRunStatus
  computedAt: string
  validatedAt: string | null
  paidAt: string | null
  lines: number
  total: number
  paidLines: number
  pending: number
}

export interface PayRunLine {
  id: string
  userId: string
  firstName: string
  lastName: string
  role: Role
  phone: string | null
  groupName: string | null
  gridId: string | null
  gridName: string | null
  items: PayItem[]
  gross: number
  adjustments: number
  total: number
  paidAt: string | null
  paymentReference: string | null
}

export interface PayAdjustment {
  id: string
  userId: string
  amount: number
  reason: string
  status: AdjustmentStatus
  createdAt: string
  decidedAt: string | null
  proposedBy: string | null
}

export interface PayRunDetail {
  id: string
  period: PayPeriod
  periodStart: string
  periodEnd: string
  label: string
  status: PayRunStatus
  computedAt: string
  validatedAt: string | null
  paidAt: string | null
  currency: string
  lines: PayRunLine[]
  adjustments: PayAdjustment[]
}
