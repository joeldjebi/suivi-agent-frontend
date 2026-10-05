import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileX,
  Flag,
  LogIn,
  Mail,
  Phone,
  Repeat,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { PeriodPicker } from '@/components/app/period-picker'
import { EmptyState, Page, QueryState } from '@/components/app/page'
import { StatusPill } from '@/components/app/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatDate, formatDateTime, formatPhone, fullName } from '@/lib/format'
import type { LeadTimeline, TeamLeadDetail, TimelineEvent, TimelineType } from '@/lib/types'
import { usePeriod } from '@/lib/period'
import { cn } from '@/lib/utils'
import { daysSince, formatResponse, leadAlerts, responseTone } from './helpers'
import { LeadAvatar } from './shared'

const PAGE_SIZE = 30

/** Filtres du fil : chaque puce regroupe un ou plusieurs types d'actions. */
const FILTERS: { key: string; label: string; types: TimelineType[] }[] = [
  {
    key: 'zones',
    label: 'Demandes de zone',
    types: ['zone.approved', 'zone.rejected', 'zone.unanswered'],
  },
  { key: 'reassign', label: 'Changements de zone', types: ['zone.reassigned'] },
  {
    key: 'forms',
    label: 'Formulaires rejetés',
    types: ['submission.rejected'],
  },
  {
    key: 'missions',
    label: 'Missions',
    types: ['mission.created', 'mission.result'],
  },
  { key: 'logins', label: 'Connexions', types: ['login'] },
]

const EVENT: Record<TimelineType, { icon: LucideIcon; tone: string }> = {
  login: { icon: LogIn, tone: 'bg-muted text-muted-foreground' },
  'zone.approved': {
    icon: CheckCircle2,
    tone: 'bg-status-active/10 text-status-active',
  },
  'zone.rejected': {
    icon: Ban,
    tone: 'bg-status-paused/10 text-status-paused',
  },
  'zone.reassigned': { icon: Repeat, tone: 'bg-primary/10 text-primary' },
  'zone.unanswered': {
    icon: AlertTriangle,
    tone: 'bg-status-alert/10 text-status-alert',
  },
  'submission.rejected': {
    icon: FileX,
    tone: 'bg-status-paused/10 text-status-paused',
  },
  'mission.created': { icon: Target, tone: 'bg-primary/10 text-primary' },
  'mission.result': { icon: Flag, tone: 'bg-primary/10 text-primary' },
}

/** Phrase lisible pour une action. */
function describe(e: TimelineEvent): string {
  const agent = e.agent?.name ?? 'un agent'
  switch (e.type) {
    case 'login':
      return 'S’est connecté'
    case 'zone.approved':
      return `A validé la zone ${e.zone} pour ${agent}`
    case 'zone.rejected':
      return `A refusé la zone ${e.zone} à ${agent}`
    case 'zone.reassigned':
      return `A déplacé ${agent} vers la zone ${e.zone}`
    case 'zone.unanswered':
      return `N’a pas répondu à ${agent} pour la zone ${e.zone}`
    case 'submission.rejected':
      return `A rejeté un formulaire de ${agent}`
    case 'mission.created':
      return `A créé la mission « ${e.mission?.title} »`
    case 'mission.result':
      return `A validé le résultat de « ${e.mission?.title} »`
  }
}

export function TeamLeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const period = usePeriod()
  const [filters, setFilters] = useState<string[]>([])
  const [pages, setPages] = useState(1)

  const detail = useQuery({
    queryKey: ['team-leads', id, period.from, period.to],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await api.get<TeamLeadDetail>(`/team-leads/${id}`, {
          params: { from: period.from, to: period.to },
        })
      ).data,
  })
  const types = FILTERS.filter((f) => filters.includes(f.key)).flatMap((f) => f.types)
  const timeline = useQuery({
    queryKey: ['team-leads', id, 'timeline', period.from, period.to, types, pages],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await api.get<LeadTimeline>(`/team-leads/${id}/timeline`, {
          params: {
            from: period.from,
            to: period.to,
            types: types.length ? types.join(',') : undefined,
            limit: PAGE_SIZE * pages,
          },
        })
      ).data,
  })
  const toggleFilter = (key: string) => {
    setPages(1)
    setFilters((f) => (f.includes(key) ? f.filter((k) => k !== key) : [...f, key]))
  }

  const lead = detail.data?.lead
  const backSearch = period.search ? `?${period.search}` : ''

  return (
    <Page>
      <Link
        to={`/team-leads${backSearch}`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Chefs d’équipe
      </Link>
      <QueryState query={detail}>
        {lead && (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-4">
                <LeadAvatar lead={lead} className="size-14 text-lg" />
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold tracking-tight">{fullName(lead)}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="size-3.5" aria-hidden /> {lead.email}
                    </span>
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                        <Phone className="size-3.5" aria-hidden /> {formatPhone(lead.phone)}
                      </a>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {lead.groups.map((g) => (
                      <Badge key={g.id} variant="secondary">
                        {g.name}
                      </Badge>
                    ))}
                    {!lead.isActive && <StatusPill tone="ended" icon={Ban} label="Compte désactivé" />}
                  </div>
                </div>
              </div>
              <PeriodPicker period={period} />
            </div>

            {leadAlerts(lead).length > 0 && (
              <div
                role="status"
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-status-alert/30 bg-status-alert/5 px-4 py-3 text-sm text-status-alert"
              >
                <AlertTriangle className="size-4" aria-hidden />
                {leadAlerts(lead).join(' · ')}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                icon={Clock}
                label="Réactivité"
                value={formatResponse(lead.avgResponseSeconds)}
                valueClass={responseTone(lead.avgResponseSeconds)}
                lines={[
                  `${lead.requestsDecided} / ${lead.requestsReceived} demandes traitées`,
                  `${lead.requestsRejected} refusée${lead.requestsRejected > 1 ? 's' : ''} · ${lead.requestsPending} en attente`,
                ]}
              />
              <Kpi
                icon={AlertTriangle}
                label="Sans réponse"
                value={String(lead.requestsUnanswered)}
                valueClass={lead.requestsUnanswered ? 'text-status-alert' : undefined}
                lines={['Demandes expirées ou validées', 'automatiquement faute de réponse']}
              />
              <Kpi
                icon={ClipboardCheck}
                label="Encadrement"
                value={String(lead.formsRejected)}
                lines={[
                  `formulaire${lead.formsRejected > 1 ? 's' : ''} rejeté${lead.formsRejected > 1 ? 's' : ''}`,
                  `${lead.missionsCreated} mission${lead.missionsCreated > 1 ? 's' : ''} créée${lead.missionsCreated > 1 ? 's' : ''} · ${lead.reassignments} réaffectation${lead.reassignments > 1 ? 's' : ''}`,
                ]}
              />
              <Kpi
                icon={LogIn}
                label="Présence"
                value={`${lead.loginDays} j`}
                valueClass={(daysSince(lead.lastLoginAt) ?? 99) >= 3 ? 'text-status-paused' : undefined}
                lines={[
                  `jour${lead.loginDays > 1 ? 's' : ''} avec connexion`,
                  lead.lastLoginAt ? `Dernière : ${formatDateTime(lead.lastLoginAt)}` : 'Jamais connecté',
                ]}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <section aria-labelledby="timeline-title" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="timeline-title" className="font-semibold">
                    Fil d’actions
                    {timeline.data && <span className="ml-2 text-sm font-normal text-muted-foreground">{timeline.data.total}</span>}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Types d’actions">
                  {FILTERS.map((f) => (
                    <Button
                      key={f.key}
                      size="sm"
                      variant={filters.includes(f.key) ? 'default' : 'outline'}
                      aria-pressed={filters.includes(f.key)}
                      onClick={() => toggleFilter(f.key)}
                      className="rounded-full"
                    >
                      {f.label}
                    </Button>
                  ))}
                  {filters.length > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setFilters([])}>
                      Tout afficher
                    </Button>
                  )}
                </div>
                <QueryState query={timeline}>
                  {timeline.data && timeline.data.items.length === 0 ? (
                    <EmptyState icon={Clock} title="Aucune action sur la période" />
                  ) : (
                    <ol className="flex flex-col rounded-lg border bg-card">
                      {timeline.data?.items.map((e, i) => {
                        const { icon: Icon, tone } = EVENT[e.type]
                        return (
                          <li key={`${e.type}-${e.at}-${i}`} className="flex gap-3 border-b px-4 py-3 last:border-b-0">
                            <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full', tone)}>
                              <Icon className="size-4" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm">
                                {describe(e)}
                                {e.responseSeconds !== null && (
                                  <span className={cn('ml-1 text-xs font-medium', responseTone(e.responseSeconds))}>
                                    · en {formatResponse(e.responseSeconds)}
                                  </span>
                                )}
                              </p>
                              {(e.detail || (e.type === 'submission.rejected' && e.mission)) && (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {e.type === 'submission.rejected' && e.mission ? `${e.mission.title} — ` : ''}
                                  {e.type === 'mission.created' && e.detail ? `Pour le groupe ${e.detail}` : e.detail}
                                </p>
                              )}
                            </div>
                            <time dateTime={e.at} className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {formatDateTime(e.at)}
                            </time>
                          </li>
                        )
                      })}
                    </ol>
                  )}
                  {timeline.data && timeline.data.items.length < timeline.data.total && (
                    <Button variant="outline" className="self-center" disabled={timeline.isFetching} onClick={() => setPages((p) => p + 1)}>
                      Afficher plus ({timeline.data.total - timeline.data.items.length} restantes)
                    </Button>
                  )}
                </QueryState>
              </section>

              <section aria-labelledby="team-title" className="flex flex-col gap-3">
                <h2 id="team-title" className="flex items-center gap-2 font-semibold">
                  <Users className="size-4" aria-hidden /> Son équipe
                  <span className="text-sm font-normal text-muted-foreground">
                    {lead.teamActiveAgents} / {lead.agents} actifs · {lead.teamDays} journées
                  </span>
                </h2>
                {(detail.data?.agents ?? []).length === 0 ? (
                  <EmptyState icon={Users} title="Aucun agent" description="Ce chef n’a pas encore d’agent dans ses groupes." />
                ) : (
                  <div className="overflow-hidden rounded-lg border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Agent</TableHead>
                          <TableHead className="text-right">Journées</TableHead>
                          <TableHead>Dernier jour</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(detail.data?.agents ?? []).map((a) => (
                          <TableRow key={a.id}>
                            <TableCell>
                              <div className="font-medium">{fullName(a)}</div>
                              {lead.groups.length > 1 && <div className="text-xs text-muted-foreground">{a.groupName}</div>}
                            </TableCell>
                            <TableCell className={cn('text-right tabular-nums', a.days === 0 && 'text-status-paused')}>{a.days}</TableCell>
                            <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                              {a.lastDay ? formatDate(a.lastDay) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </QueryState>
    </Page>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  lines,
  valueClass,
}: {
  icon: LucideIcon
  label: string
  value: string
  lines: string[]
  valueClass?: string
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {label}
      </p>
      <p className={cn('mt-1 text-3xl font-semibold tabular-nums', valueClass)}>{value}</p>
      {lines.map((l) => (
        <p key={l} className="text-xs text-muted-foreground">
          {l}
        </p>
      ))}
    </div>
  )
}
