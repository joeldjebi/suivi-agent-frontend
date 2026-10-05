import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlarmClock, AlertTriangle, CalendarDays, ChevronRight, ClipboardCheck, Clock, FileText, Footprints, Users, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Page, PageHeader, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { PeriodPicker } from '@/components/app/period-picker'
import { SearchInput } from '@/components/app/search-input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDate, formatDuration, formatNumber, fullName } from '@/lib/format'
import { usePaged } from '@/lib/pagination'
import { usePeriod } from '@/lib/period'
import { useAgents, useGroups, useZones } from '@/lib/queries'
import type { StatsOverview } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Card, Chart, Kpi, clock, dayLabel, hours, percent } from './components'
import { StatsDetailSheet, type StatsTarget } from './StatsDetailSheet'

const ALL = 'all'
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

type Metric = 'activeAgents' | 'hours' | 'forms'
const METRICS: Record<Metric, string> = { activeAgents: 'Agents actifs', hours: 'Heures travaillées', forms: 'Formulaires' }

export function StatsPage() {
  const { settings } = useMe()
  const groups = useGroups()
  const zoneList = useZones()
  const agentList = useAgents()
  const period = usePeriod()
  const [groupId, setGroupId] = useState(ALL)
  const [zoneId, setZoneId] = useState(ALL)
  const [agentId, setAgentId] = useState(ALL)
  const [metric, setMetric] = useState<Metric>('activeAgents')
  const [agentSearch, setAgentSearch] = useState('')
  const [detail, setDetail] = useState<StatsTarget | null>(null)

  const filters = {
    groupId: groupId === ALL ? undefined : groupId,
    zoneId: zoneId === ALL ? undefined : zoneId,
    agentId: agentId === ALL ? undefined : agentId,
  }
  const filtersActive = !!(filters.groupId || filters.zoneId || filters.agentId)
  const resetFilters = () => {
    setGroupId(ALL)
    setZoneId(ALL)
    setAgentId(ALL)
  }

  const query = useQuery({
    queryKey: ['stats', period.from, period.to, filters],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<StatsOverview>('/stats/overview', { params: { from: period.from, to: period.to, ...filters } })).data,
  })
  const d = query.data

  const daily = useMemo(
    () =>
      (d?.daily ?? []).map((x) => ({
        date: x.date,
        label: dayLabel(x.date),
        activeAgents: x.activeAgents,
        hours: hours(x.workedSeconds),
        forms: x.forms,
      })),
    [d],
  )
  const weekdays = useMemo(
    () => WEEKDAYS.map((label, i) => ({ label, hours: hours(d?.weekdays.find((w) => w.weekday === i + 1)?.workedSeconds ?? 0) })),
    [d],
  )
  const startHours = useMemo(() => {
    const list = d?.startHours ?? []
    if (!list.length) return []
    const min = Math.min(...list.map((h) => h.hour))
    const max = Math.max(...list.map((h) => h.hour))
    return Array.from({ length: max - min + 1 }, (_, i) => ({
      label: `${min + i} h`,
      days: list.find((h) => h.hour === min + i)?.days ?? 0,
    }))
  }, [d])

  const needle = agentSearch.trim().toLowerCase()
  const agentRows = useMemo(
    () =>
      (d?.agents ?? [])
        .map((a, i) => ({ ...a, rank: i + 1 }))
        .filter((a) => !needle || `${fullName(a)} ${a.groupName ?? ''}`.toLowerCase().includes(needle)),
    [d, needle],
  )
  const agentsPaged = usePaged(agentRows, 10)
  const groupsPaged = usePaged(d?.groups ?? [], 8)
  const zonesPaged = usePaged(d?.zones ?? [], 8)

  // Détail d'un élément, sur la période de la page et avec ses filtres.
  const open = (target: Omit<StatsTarget, 'from' | 'to'> & { from?: string; to?: string }) =>
    setDetail({ from: period.from, to: period.to, ...filters, ...target })
  const applyFilter = (t: StatsTarget) => {
    if (t.groupId) setGroupId(t.groupId)
    if (t.zoneId) setZoneId(t.zoneId)
    if (t.agentId) setAgentId(t.agentId)
    setDetail(null)
  }

  const k = d?.kpis
  const p = d?.previousKpis

  return (
    <Page>
      <PageHeader
        title="Statistiques"
        description="Vue d’ensemble de l’activité de vos agents, comparée à la période précédente. Cliquez sur un groupe, une zone, un agent ou un jour pour en voir le détail."
      />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <PeriodPicker period={period} />
        {settings.useGroups && (
          <FilterSelect
            label="Groupe"
            value={groupId}
            onChange={setGroupId}
            options={{ [ALL]: 'Tous les groupes', ...Object.fromEntries((groups.data ?? []).map((g) => [g.id, g.name])) }}
          />
        )}
        <FilterSelect
          label="Zone"
          value={zoneId}
          onChange={setZoneId}
          options={{ [ALL]: 'Toutes les zones', ...Object.fromEntries((zoneList.data ?? []).map((z) => [z.id, z.name])) }}
        />
        <FilterSelect
          label="Agent"
          value={agentId}
          onChange={setAgentId}
          options={{ [ALL]: 'Tous les agents', ...Object.fromEntries((agentList.data ?? []).map((a) => [a.id, fullName(a)])) }}
        />
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <X aria-hidden /> Effacer les filtres
          </Button>
        )}
        {d && (
          <p className="ml-auto text-xs text-muted-foreground">
            Comparé au {formatDate(d.previous.from)} – {formatDate(d.previous.to)}
          </p>
        )}
      </div>

      <QueryState query={query} rows={8}>
        {d && k && p && (
          <div className={cn('flex flex-col gap-5', query.isPlaceholderData && 'opacity-60')}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi
                icon={Users}
                label="Agents actifs"
                value={`${k.activeAgents}`}
                suffix={`/ ${k.totalAgents}`}
                delta={[k.activeAgents, p.activeAgents]}
                hint={`${formatNumber(percent(k.activeAgents, k.totalAgents))} % des agents ont travaillé`}
              />
              <Kpi
                icon={CalendarDays}
                label="Journées travaillées"
                value={formatNumber(k.days)}
                delta={[k.days, p.days]}
                hint={`${k.activeAgents ? formatNumber(k.days / k.activeAgents) : 0} par agent actif`}
              />
              <Kpi
                icon={Clock}
                label="Temps travaillé"
                value={formatDuration(k.workedSeconds)}
                delta={[k.workedSeconds, p.workedSeconds]}
                hint={`${k.days ? formatDuration(k.workedSeconds / k.days) : '—'} par journée`}
              />
              <Kpi
                icon={AlarmClock}
                label="Heure moyenne de début"
                value={clock(k.avgStartMinutes)}
                hint={`${k.autoClosedDays} journée${k.autoClosedDays > 1 ? 's' : ''} non clôturée${k.autoClosedDays > 1 ? 's' : ''} par l’agent`}
              />
              <Kpi
                icon={FileText}
                label="Formulaires envoyés"
                value={formatNumber(k.forms)}
                delta={[k.forms, p.forms]}
                hint={`${k.formsRejected} rejeté${k.formsRejected > 1 ? 's' : ''} (${formatNumber(percent(k.formsRejected, k.forms + k.formsRejected))} %) · ${k.days ? formatNumber(k.forms / k.days) : 0} par journée`}
              />
              <Kpi
                icon={Footprints}
                label="Distance parcourue"
                value={`${formatNumber(k.distanceKm)} km`}
                delta={[k.distanceKm, p.distanceKm]}
                hint={`${k.days ? formatNumber(Math.round((k.distanceKm / k.days) * 10) / 10) : 0} km par journée`}
              />
              <Kpi
                icon={AlertTriangle}
                label="Positions hors zone"
                value={`${formatNumber(percent(k.outsidePositions, k.positions))} %`}
                tone={percent(k.outsidePositions, k.positions) > 5 ? 'text-status-alert' : undefined}
                hint={`${formatNumber(k.mockedPositions)} position${k.mockedPositions > 1 ? 's' : ''} simulée${k.mockedPositions > 1 ? 's' : ''} sur ${formatNumber(k.positions)}`}
              />
              <Kpi
                icon={ClipboardCheck}
                label="Demandes de zone"
                value={formatNumber(k.requests.total)}
                hint={`${k.requests.needingApproval} à valider · délai moyen ${k.requests.avgResponseSeconds === null ? '—' : formatDuration(Math.max(60, k.requests.avgResponseSeconds))} · ${k.requests.unanswered} sans réponse`}
              />
            </div>

            <Card
              title="Activité jour par jour"
              actions={
                <div className="flex gap-1" role="group" aria-label="Indicateur affiché">
                  {(Object.keys(METRICS) as Metric[]).map((m) => (
                    <Button
                      key={m}
                      size="sm"
                      variant={metric === m ? 'default' : 'outline'}
                      aria-pressed={metric === m}
                      onClick={() => setMetric(m)}
                    >
                      {METRICS[m]}
                    </Button>
                  ))}
                </div>
              }
            >
              <Chart
                data={daily}
                dataKey={metric}
                name={METRICS[metric]}
                onSelect={(i) => {
                  const day = daily[i]
                  if (day)
                    open({ title: `Journée du ${formatDate(day.date)}`, subtitle: 'Activité de ce jour', from: day.date, to: day.date })
                }}
              />
              <p className="mt-2 text-xs text-muted-foreground">Cliquez sur une barre pour voir le détail de la journée.</p>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card title="Heures par jour de la semaine">
                <Chart data={weekdays} dataKey="hours" name="Heures travaillées" height={220} />
              </Card>
              <Card title="Heure de début des journées">
                <Chart data={startHours} dataKey="days" name="Journées" height={220} color="var(--status-active)" />
              </Card>
            </div>

            {settings.useGroups && d.groups.length > 0 && (
              <Card title="Par groupe" flush>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Groupe</TableHead>
                      <TableHead className="text-right">Agents actifs</TableHead>
                      <TableHead className="text-right">Journées</TableHead>
                      <TableHead className="text-right">Temps travaillé</TableHead>
                      <TableHead className="text-right">Formulaires</TableHead>
                      <TableHead className="text-right">Délai de validation</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupsPaged.items.map((g) => (
                      <TableRow key={g.id} className="relative cursor-pointer">
                        <TableCell className="font-medium">
                          <DetailButton onClick={() => open({ title: g.name, subtitle: 'Statistiques du groupe', groupId: g.id })}>
                            {g.name}
                          </DetailButton>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {g.activeAgents} <span className="text-muted-foreground">/ {g.agents}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{g.days}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDuration(g.workedSeconds)}
                          <div className="text-xs text-muted-foreground">
                            {g.days ? formatDuration(g.workedSeconds / g.days) : '—'} / journée
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {g.forms}
                          {g.formsRejected > 0 && (
                            <div className="text-xs text-status-alert">
                              {g.formsRejected} rejeté{g.formsRejected > 1 ? 's' : ''}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {g.avgResponseSeconds === null ? '—' : formatDuration(Math.max(60, g.avgResponseSeconds))}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination paged={groupsPaged} />
              </Card>
            )}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
              <Card title="Par zone" flush>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zone</TableHead>
                      <TableHead className="text-right">Journées</TableHead>
                      <TableHead className="text-right">Agents</TableHead>
                      <TableHead className="text-right">Temps</TableHead>
                      <TableHead className="w-40">Remplissage</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zonesPaged.items.map((z) => (
                      <TableRow key={z.id} className="relative cursor-pointer">
                        <TableCell className="font-medium">
                          <DetailButton onClick={() => open({ title: z.name, subtitle: 'Statistiques de la zone', zoneId: z.id })}>
                            {z.name}
                          </DetailButton>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{z.days}</TableCell>
                        <TableCell className="text-right tabular-nums">{z.agents}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatDuration(z.workedSeconds)}</TableCell>
                        <TableCell>
                          {z.occupancy === null ? (
                            <span className="text-xs text-muted-foreground">Sans limite de places</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Progress
                                value={Math.min(100, z.occupancy * 100)}
                                className="h-1.5 flex-1"
                                aria-label={`Remplissage de ${z.name}`}
                              />
                              <span className="w-10 text-right text-xs tabular-nums">{Math.round(z.occupancy * 100)} %</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination paged={zonesPaged} />
              </Card>

              <Card
                title="Missions en cours"
                actions={
                  <span className="text-xs text-muted-foreground">
                    {k.missions.achieved} atteintes · {k.missions.failed} échouées sur la période
                  </span>
                }
              >
                {d.openMissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune mission en cours.</p>
                ) : (
                  <ul className="flex flex-col gap-4">
                    {d.openMissions.map((m) => (
                      <li key={m.id}>
                        <div className="flex items-baseline justify-between gap-2">
                          <Link to={`/missions/${m.id}`} className="truncate text-sm font-medium hover:underline">
                            {m.title}
                          </Link>
                          <span className="shrink-0 text-xs tabular-nums">{m.progress.percent} %</span>
                        </div>
                        <Progress value={m.progress.percent} className="mt-1.5 h-1.5" aria-label={`Progression de ${m.title}`} />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatNumber(m.progress.current)} / {formatNumber(m.progress.target)}
                          {m.dueDate && ` · avant le ${formatDate(m.dueDate)}`}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <Card
              title={`Agents (${d.agents.length})`}
              flush
              actions={
                <SearchInput
                  value={agentSearch}
                  onChange={setAgentSearch}
                  placeholder="Rechercher un agent"
                  label="Rechercher un agent"
                  className="w-56"
                />
              }
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-right">Journées</TableHead>
                    <TableHead className="text-right">Temps travaillé</TableHead>
                    <TableHead className="text-right">Formulaires</TableHead>
                    <TableHead className="text-right">Distance</TableHead>
                    <TableHead className="text-right">Fins auto</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentsPaged.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                        Aucun agent ne correspond.
                      </TableCell>
                    </TableRow>
                  )}
                  {agentsPaged.items.map((a) => (
                    <TableRow key={a.id} className="relative cursor-pointer">
                      <TableCell className="text-muted-foreground tabular-nums">{a.rank}</TableCell>
                      <TableCell>
                        <DetailButton
                          onClick={() =>
                            open({ title: fullName(a), subtitle: a.groupName ? `Agent · ${a.groupName}` : 'Agent', agentId: a.id })
                          }
                        >
                          {fullName(a)}
                        </DetailButton>
                        {a.groupName && <div className="text-xs text-muted-foreground">{a.groupName}</div>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{a.days}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatDuration(a.workedSeconds)}
                        <div className="text-xs text-muted-foreground">{formatDuration(a.workedSeconds / a.days)} / journée</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.forms}
                        {a.formsRejected > 0 && (
                          <div className="text-xs text-status-alert">
                            {a.formsRejected} rejeté{a.formsRejected > 1 ? 's' : ''}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(a.distanceKm)} km</TableCell>
                      <TableCell className={cn('text-right tabular-nums', a.autoClosedDays > 0 && 'text-status-paused')}>
                        {a.autoClosedDays}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination paged={agentsPaged} />
            </Card>
          </div>
        )}
      </QueryState>

      <StatsDetailSheet target={detail} onClose={() => setDetail(null)} onApply={applyFilter} />
    </Page>
  )
}

/** Libellé cliquable qui couvre toute la ligne. */
function DetailButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left font-medium after:absolute after:inset-0 hover:underline focus-visible:underline focus-visible:outline-none"
    >
      {children}
    </button>
  )
}

function TablePagination({
  paged,
}: {
  paged: { page: number; pages: number; total: number; pageSize: number; setPage: (p: number) => void }
}) {
  if (paged.pages <= 1) return null
  return (
    <div className="border-t px-4 py-2">
      <Pagination page={paged.page} pages={paged.pages} total={paged.total} pageSize={paged.pageSize} onPage={paged.setPage} />
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Record<string, string>
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v ?? ALL)}>
        <SelectTrigger className="w-48" aria-label={label}>
          <SelectValue>{(v: string) => options[v]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([k, l]) => (
            <SelectItem key={k} value={k}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
