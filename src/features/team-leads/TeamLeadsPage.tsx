import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Clock,
  Hourglass,
  Search,
  ShieldCheck,
  UserCog,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { PeriodPicker } from '@/components/app/period-picker'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatRelative, fullName } from '@/lib/format'
import type { LeadStats, TeamLeadsOverview } from '@/lib/types'
import { usePeriod } from '@/lib/period'
import { cn } from '@/lib/utils'
import { ABSENT_DAYS, daysSince, formatResponse, leadAlerts, responseTone } from './helpers'
import { LeadAvatar } from './shared'

type SortKey = 'name' | 'response' | 'unanswered' | 'decided' | 'lastLogin'
type Sort = { key: SortKey; desc: boolean }

const sorters: Record<SortKey, (a: LeadStats, b: LeadStats) => number> = {
  name: (a, b) => a.lastName.localeCompare(b.lastName, 'fr'),
  // Sans décision, le chef passe après les autres.
  response: (a, b) => (a.avgResponseSeconds ?? Infinity) - (b.avgResponseSeconds ?? Infinity),
  unanswered: (a, b) => a.requestsUnanswered - b.requestsUnanswered,
  decided: (a, b) => a.requestsDecided - b.requestsDecided,
  lastLogin: (a, b) => (a.lastLoginAt ?? '').localeCompare(b.lastLoginAt ?? ''),
}

export function TeamLeadsPage() {
  const period = usePeriod()
  const [search, setSearch] = useState('')
  const [alertsOnly, setAlertsOnly] = useState(false)
  const [sort, setSort] = useState<Sort>({ key: 'name', desc: false })

  const query = useQuery({
    queryKey: ['team-leads', period.from, period.to],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await api.get<TeamLeadsOverview>('/team-leads', {
          params: { from: period.from, to: period.to },
        })
      ).data,
  })
  const leads = useMemo(() => query.data?.leads ?? [], [query.data])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const list = leads
      .filter((l) => !needle || `${fullName(l)} ${l.email} ${l.groups.map((g) => g.name).join(' ')}`.toLowerCase().includes(needle))
      .filter((l) => !alertsOnly || leadAlerts(l).length > 0)
      .sort(sorters[sort.key])
    return sort.desc ? list.reverse() : list
  }, [leads, search, alertsOnly, sort])

  // Vue d'ensemble : délai moyen pondéré par le nombre de décisions.
  const decided = leads.reduce((s, l) => s + l.requestsDecided, 0)
  const weighted = leads.reduce((s, l) => s + (l.avgResponseSeconds ?? 0) * l.requestsDecided, 0)
  const unanswered = leads.reduce((s, l) => s + l.requestsUnanswered, 0)
  const pending = leads.reduce((s, l) => s + l.requestsPending, 0)
  const absent = leads.filter((l) => {
    const d = daysSince(l.lastLoginAt)
    return d === null || d >= ABSENT_DAYS
  }).length

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'name' && key !== 'response' }))
  const linkSearch = period.search ? `?${period.search}` : ''

  return (
    <Page>
      <PageHeader
        title="Chefs d’équipe"
        description="Réactivité sur les demandes de zone, encadrement des agents et présence de chaque chef."
      />

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-card p-3">
        <PeriodPicker period={period} />
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead-search">Recherche</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="lead-search"
                type="search"
                placeholder="Nom, email ou groupe"
                className="w-64 pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <label className="flex h-9 items-center gap-2 text-sm">
            <Switch checked={alertsOnly} onCheckedChange={setAlertsOnly} aria-label="Avec points d’attention seulement" />
            Points d’attention seulement
          </label>
        </div>
      </div>

      <QueryState query={query}>
        {query.data && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                icon={Clock}
                label="Délai moyen de réponse"
                value={formatResponse(decided ? Math.round(weighted / decided) : null)}
                valueClass={responseTone(decided ? weighted / decided : null)}
                hint={`${decided} demande${decided > 1 ? 's' : ''} traitée${decided > 1 ? 's' : ''}`}
              />
              <Kpi
                icon={AlertTriangle}
                label="Demandes sans réponse"
                value={String(unanswered)}
                valueClass={unanswered ? 'text-status-alert' : undefined}
                hint="Expirées ou validées automatiquement"
              />
              <Kpi icon={Hourglass} label="En attente maintenant" value={String(pending)} hint="Demandes à traiter par les chefs" />
              <Kpi
                icon={WifiOff}
                label="Chefs absents"
                value={`${absent} / ${leads.length}`}
                valueClass={absent ? 'text-status-paused' : undefined}
                hint={`Sans connexion depuis ${ABSENT_DAYS} jours ou plus`}
              />
            </div>

            {rows.length === 0 ? (
              <EmptyState
                icon={UserCog}
                title={leads.length ? 'Aucun chef ne correspond' : 'Aucun chef d’équipe'}
                description={
                  leads.length ? 'Modifiez la recherche ou les filtres.' : 'Créez un utilisateur avec le rôle « Chef d’équipe ».'
                }
              />
            ) : (
              <div className={cn('overflow-x-auto rounded-lg border bg-card', query.isPlaceholderData && 'opacity-60')}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHead label="Chef" sortKey="name" sort={sort} onSort={toggleSort} />
                      <TableHead>Équipe</TableHead>
                      <SortHead label="Demandes traitées" sortKey="decided" sort={sort} onSort={toggleSort} align="right" />
                      <SortHead label="Délai moyen" sortKey="response" sort={sort} onSort={toggleSort} align="right" />
                      <SortHead label="Sans réponse" sortKey="unanswered" sort={sort} onSort={toggleSort} align="right" />
                      <TableHead className="text-right" title="Formulaires rejetés, missions créées, réaffectations">
                        Encadrement
                      </TableHead>
                      <SortHead label="Dernière connexion" sortKey="lastLogin" sort={sort} onSort={toggleSort} />
                      <TableHead>Points d’attention</TableHead>
                      <TableHead>
                        <span className="sr-only">Fiche</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((l) => {
                      const alerts = leadAlerts(l)
                      const absentDays = daysSince(l.lastLoginAt)
                      return (
                        <TableRow key={l.id} className="relative">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <LeadAvatar lead={l} />
                              <div>
                                <Link
                                  to={`/team-leads/${l.id}${linkSearch}`}
                                  className="font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-none"
                                >
                                  {fullName(l)}
                                </Link>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {l.groups.map((g) => (
                                <Badge key={g.id} variant="secondary">
                                  {g.name}
                                </Badge>
                              ))}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {l.agents} agent{l.agents > 1 ? 's' : ''} · {l.teamActiveAgents} actif
                              {l.teamActiveAgents > 1 ? 's' : ''}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className="font-medium">{l.requestsDecided}</span>
                            <span className="text-muted-foreground"> / {l.requestsReceived}</span>
                            {l.requestsRejected > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {l.requestsRejected} refusée
                                {l.requestsRejected > 1 ? 's' : ''}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className={cn('text-right font-medium tabular-nums', responseTone(l.avgResponseSeconds))}>
                            {formatResponse(l.avgResponseSeconds)}
                          </TableCell>
                          <TableCell className={cn('text-right tabular-nums', l.requestsUnanswered > 0 && 'font-medium text-status-alert')}>
                            {l.requestsUnanswered}
                          </TableCell>
                          <TableCell className="text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                            <div>
                              {l.formsRejected} rejet{l.formsRejected > 1 ? 's' : ''}
                            </div>
                            <div>
                              {l.missionsCreated} miss. · {l.reassignments} réaff.
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className={cn(absentDays === null || absentDays >= ABSENT_DAYS ? 'text-status-paused' : undefined)}>
                              {l.lastLoginAt ? formatRelative(l.lastLoginAt) : 'Jamais'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {l.loginDays} jour{l.loginDays > 1 ? 's' : ''} connecté{l.loginDays > 1 ? 's' : ''}
                            </div>
                          </TableCell>
                          <TableCell>
                            {alerts.length === 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs text-status-active">
                                <ShieldCheck className="size-3.5" aria-hidden /> RAS
                              </span>
                            ) : (
                              <ul className="flex max-w-44 flex-col gap-0.5 text-xs text-status-alert">
                                {alerts.map((a) => (
                                  <li key={a} className="flex items-start gap-1">
                                    <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden /> {a}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
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
  hint,
  valueClass,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  valueClass?: string
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {label}
      </p>
      <p className={cn('mt-1 text-3xl font-semibold tabular-nums', valueClass)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SortHead({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: SortKey
  sort: Sort
  onSort: (key: SortKey) => void
  align?: 'left' | 'right'
}) {
  const active = sort.key === sortKey
  const Icon = !active ? ArrowUpDown : sort.desc ? ArrowDown : ArrowUp
  return (
    <TableHead
      aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}
      className={align === 'right' ? 'text-right' : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm font-medium whitespace-nowrap hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          align === 'right' && 'flex-row-reverse',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
        <Icon className={cn('size-3.5', !active && 'opacity-50')} aria-hidden />
      </button>
    </TableHead>
  )
}
