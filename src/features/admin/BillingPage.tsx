import { Feature } from '@suivi/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Receipt,
  Search,
  UserX,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDuration, formatNumber, formatPhone, fullName } from '@/lib/format'
import { useGroups, useZones } from '@/lib/queries'
import { useFeature } from '@/lib/subscription'
import type { ActiveAgents, BillingAgent } from '@/lib/types'
import { cn } from '@/lib/utils'

const ALL = 'all'
const MIN_DAYS = [1, 5, 10, 15, 20] as const

type SortKey = 'name' | 'days' | 'worked' | 'forms' | 'lastDay'
type Sort = { key: SortKey; desc: boolean }

const sorters: Record<SortKey, (a: BillingAgent, b: BillingAgent) => number> = {
  name: (a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'),
  days: (a, b) => a.days - b.days,
  worked: (a, b) => a.workedSeconds - b.workedSeconds,
  forms: (a, b) => a.forms - b.forms,
  lastDay: (a, b) => a.lastDay.localeCompare(b.lastDay),
}

/** « 18 sept. » : l'année est déjà celle du mois choisi. */
const shortDay = (day: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))

const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(`${month}-15T12:00:00Z`))

/** Export pour la comptabilité : séparateur « ; » et BOM pour Excel en français. */
function exportCsv(data: ActiveAgents, rows: BillingAgent[]) {
  const header = [
    'Nom',
    'Prénom',
    'Téléphone',
    'Email',
    'Groupe',
    'Compte',
    'Journées',
    'Heures travaillées',
    'Moyenne par journée (h)',
    'Premier jour',
    'Dernier jour',
    'Zone principale',
    'Zones',
    'Formulaires',
    'Formulaires rejetés',
    'Fins automatiques',
  ]
  const hours = (s: number) => (s / 3600).toFixed(2).replace('.', ',')
  const lines = rows.map((a) =>
    [
      a.lastName,
      a.firstName,
      a.phone ?? '',
      a.email,
      a.groupName ?? '',
      a.isActive ? 'Actif' : 'Désactivé',
      a.days,
      hours(a.workedSeconds),
      hours(a.workedSeconds / a.days),
      a.firstDay,
      a.lastDay,
      a.mainZone ?? '',
      a.zones,
      a.forms,
      a.rejectedForms,
      a.autoClosedDays,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(';'),
  )
  const blob = new Blob([`﻿${[header.join(';'), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `agents-actifs-${data.month}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function BillingPage() {
  const { settings } = useMe()
  const canExport = useFeature(Feature.Exports)
  const groups = useGroups(true)
  const zones = useZones(true)
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [groupId, setGroupId] = useState(ALL)
  const [zoneId, setZoneId] = useState(ALL)
  const [account, setAccount] = useState(ALL)
  const [minDays, setMinDays] = useState('1')
  const [sort, setSort] = useState<Sort>({ key: 'name', desc: false })

  // Recherche envoyée après une courte pause de frappe.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const filtersActive = search !== '' || groupId !== ALL || zoneId !== ALL || account !== ALL || minDays !== '1'
  const resetFilters = () => {
    setSearchInput('')
    setSearch('')
    setGroupId(ALL)
    setZoneId(ALL)
    setAccount(ALL)
    setMinDays('1')
  }

  const query = useQuery({
    queryKey: ['billing', { month, search, groupId, zoneId, account, minDays }],
    enabled: /^\d{4}-\d{2}$/.test(month),
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await api.get<ActiveAgents>('/billing/active-agents', {
          params: {
            month,
            search: search || undefined,
            groupId: groupId === ALL ? undefined : groupId,
            zoneId: zoneId === ALL ? undefined : zoneId,
            account: account === ALL ? undefined : account,
            minDays: minDays === '1' ? undefined : Number(minDays),
          },
        })
      ).data,
  })
  const data = query.data
  const rows = useMemo(() => {
    const list = [...(data?.agents ?? [])].sort(sorters[sort.key])
    return sort.desc ? list.reverse() : list
  }, [data, sort])
  const maxDays = Math.max(1, ...rows.map((a) => a.days))

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'name' }))

  return (
    <Page>
      <PageHeader
        title="Agents actifs"
        description="Agents ayant démarré au moins une journée dans le mois, avec leur activité. Les filtres ne changent que la liste, pas le total du mois."
        actions={
          <Button
            variant="outline"
            disabled={!data || rows.length === 0 || !canExport}
            title={canExport ? undefined : 'Export inclus à partir de la formule Avancée'}
            onClick={() => data && exportCsv(data, rows)}
          >
            <Download aria-hidden /> Exporter (CSV)
          </Button>
        }
      />

      <div className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[11rem_minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="month">Mois</Label>
          <Input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5 lg:col-span-2 xl:col-span-1">
          <Label htmlFor="billing-search">Recherche</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="billing-search"
              type="search"
              placeholder="Nom, email ou numéro"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        {settings.useGroups && (
          <div className="flex flex-col gap-1.5">
            <Label>Groupe</Label>
            <Select value={groupId} onValueChange={(v) => setGroupId(v ?? ALL)}>
              <SelectTrigger className="w-full" aria-label="Groupe">
                <SelectValue>{(v: string) => (v === ALL ? 'Tous les groupes' : groups.data?.find((g) => g.id === v)?.name)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les groupes</SelectItem>
                {groups.data?.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label>Zone travaillée</Label>
          <Select value={zoneId} onValueChange={(v) => setZoneId(v ?? ALL)}>
            <SelectTrigger className="w-full" aria-label="Zone travaillée">
              <SelectValue>{(v: string) => (v === ALL ? 'Toutes les zones' : zones.data?.find((z) => z.id === v)?.name)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes les zones</SelectItem>
              {zones.data?.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Compte</Label>
          <Select value={account} onValueChange={(v) => setAccount(v ?? ALL)}>
            <SelectTrigger className="w-full" aria-label="Compte">
              <SelectValue>{(v: string) => ({ [ALL]: 'Tous les comptes', active: 'Actifs', inactive: 'Désactivés' })[v]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les comptes</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="inactive">Désactivés</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Journées</Label>
          <Select value={minDays} onValueChange={(v) => setMinDays(v ?? '1')}>
            <SelectTrigger className="w-full" aria-label="Journées minimum">
              <SelectValue>{(v: string) => (v === '1' ? 'Toutes' : `${v} et plus`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MIN_DAYS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n === 1 ? 'Toutes' : `${n} et plus`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <QueryState query={query}>
        {data && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                icon={Receipt}
                label="Agents actifs du mois"
                sub={monthLabel(data.month)}
                value={formatNumber(data.activeAgents)}
                hint={<Trend current={data.activeAgents} previous={data.previous.activeAgents} month={data.previous.month} />}
              />
              <Kpi
                icon={CalendarDays}
                label="Journées travaillées"
                value={formatNumber(data.shown.days)}
                hint={data.shown.agents ? `${formatNumber(data.shown.days / data.shown.agents)} par agent` : undefined}
              />
              <Kpi
                icon={Clock}
                label="Temps travaillé"
                value={formatDuration(data.shown.workedSeconds)}
                hint={data.shown.days ? `${formatDuration(data.shown.workedSeconds / data.shown.days)} par journée` : undefined}
              />
              <Kpi
                icon={FileText}
                label="Formulaires envoyés"
                value={formatNumber(data.shown.forms)}
                hint={data.shown.days ? `${formatNumber(data.shown.forms / data.shown.days)} par journée` : undefined}
              />
            </div>

            {filtersActive && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4" aria-hidden />
                <span>
                  {data.shown.agents} agent{data.shown.agents > 1 ? 's' : ''} affiché{data.shown.agents > 1 ? 's' : ''} sur{' '}
                  {data.activeAgents} actif{data.activeAgents > 1 ? 's' : ''} ce mois-ci
                </span>
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <X aria-hidden /> Effacer les filtres
                </Button>
              </div>
            )}

            {rows.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={filtersActive ? 'Aucun agent ne correspond' : 'Aucun agent actif ce mois-ci'}
                description={filtersActive ? 'Modifiez ou effacez les filtres.' : undefined}
                action={
                  filtersActive ? (
                    <Button variant="outline" size="sm" onClick={resetFilters}>
                      Effacer les filtres
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className={cn('overflow-x-auto rounded-lg border bg-card', query.isPlaceholderData && 'opacity-60')}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHead label="Agent" sortKey="name" sort={sort} onSort={toggleSort} />
                      <TableHead>Téléphone</TableHead>
                      {settings.useGroups && <TableHead>Groupe</TableHead>}
                      <TableHead>Zone principale</TableHead>
                      <SortHead label="Journées" sortKey="days" sort={sort} onSort={toggleSort} align="right" />
                      <SortHead label="Temps travaillé" sortKey="worked" sort={sort} onSort={toggleSort} align="right" />
                      <SortHead label="Période" sortKey="lastDay" sort={sort} onSort={toggleSort} />
                      <SortHead label="Formulaires" sortKey="forms" sort={sort} onSort={toggleSort} align="right" />
                      <TableHead>Compte</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="font-medium">{fullName(a)}</div>
                          <div className="text-xs text-muted-foreground">{a.email}</div>
                        </TableCell>
                        <TableCell className="tabular-nums whitespace-nowrap">
                          {a.phone ? (
                            <a className="hover:underline" href={`tel:${a.phone}`}>
                              {formatPhone(a.phone)}
                            </a>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        {settings.useGroups && <TableCell>{a.groupName ?? '—'}</TableCell>}
                        <TableCell>
                          {a.mainZone ?? '—'}
                          {a.zones > 1 && (
                            <span className="block text-xs text-muted-foreground">
                              + {a.zones - 1} autre{a.zones > 2 ? 's' : ''}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-muted sm:block" aria-hidden>
                              <div className="h-full rounded-full bg-primary" style={{ width: `${(a.days / maxDays) * 100}%` }} />
                            </div>
                            <span className="w-6 font-medium tabular-nums">{a.days}</span>
                          </div>
                          {a.autoClosedDays > 0 && (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-status-paused">
                                    <AlertTriangle className="size-3" aria-hidden />
                                    {a.autoClosedDays} fin{a.autoClosedDays > 1 ? 's' : ''} auto
                                  </span>
                                }
                              />
                              <TooltipContent>Journées non terminées par l'agent, clôturées automatiquement</TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <div className="font-medium">{formatDuration(a.workedSeconds)}</div>
                          <div className="text-xs text-muted-foreground">{formatDuration(a.workedSeconds / a.days)} / jour</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="tabular-nums">
                            {a.firstDay === a.lastDay ? shortDay(a.firstDay) : `${shortDay(a.firstDay)} → ${shortDay(a.lastDay)}`}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <div className="font-medium">{a.forms}</div>
                          {a.rejectedForms > 0 && (
                            <div className="text-xs text-status-alert">
                              {a.rejectedForms} rejeté{a.rejectedForms > 1 ? 's' : ''}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {a.isActive ? (
                            <StatusPill tone="active" icon={CheckCircle2} label="Actif" />
                          ) : (
                            <StatusPill tone="ended" icon={UserX} label="Désactivé" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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

function Kpi({ icon: Icon, label, sub, value, hint }: { icon: LucideIcon; label: string; sub?: string; value: string; hint?: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
        {sub && <span className="ml-auto shrink-0 text-xs">{sub}</span>}
      </p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Évolution du nombre d'agents actifs par rapport au mois précédent. */
function Trend({ current, previous, month }: { current: number; previous: number; month: string }) {
  const diff = current - previous
  const name = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date(`${month}-15T12:00:00Z`))
  if (diff === 0) return <>Stable par rapport à {name}</>
  return (
    <span className={diff > 0 ? 'text-status-active' : 'text-status-alert'}>
      {diff > 0 ? '+' : ''}
      {diff} par rapport à {name} ({previous})
    </span>
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
          'inline-flex items-center gap-1 rounded-sm font-medium hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
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
