import { MissionStatus } from '@suivi/shared'
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { CalendarClock, CircleSlash, Coins, Globe, MapPinned, Plus, Target, User as UserIcon, UsersRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { SearchInput } from '@/components/app/search-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MissionStatusPill, StatusPill } from '@/components/app/status'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { api } from '@/lib/api'
import { formatDate, formatNumber, fullName } from '@/lib/format'
import { missionStatusLabel, progressMethodLabel } from '@/lib/labels'
import { useAgents, useGroups, useMissionTypes, useZones } from '@/lib/queries'
import type { Mission, Page as PageOf } from '@/lib/types'
import { cn } from '@/lib/utils'
import { MissionFormDialog } from './MissionFormDialog'
import { useOpenFromQuery } from '@/lib/use-open-from-query'

const ALL = 'all'
const SORT: Record<string, string> = { recent: 'Plus récentes', due: 'Échéance la plus proche', title: 'Titre (A → Z)' }

const STATUS_BAR: Record<MissionStatus, string> = {
  [MissionStatus.Todo]: 'bg-status-ended',
  [MissionStatus.InProgress]: 'bg-primary',
  [MissionStatus.Achieved]: 'bg-status-active',
  [MissionStatus.Failed]: 'bg-status-alert',
}

export function MissionsPage() {
  const agents = useAgents()
  const groups = useGroups()
  const types = useMissionTypes(true)
  const [status, setStatus] = useState(ALL)
  const [showInactive, setShowInactive] = useState(false)
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  useOpenFromQuery(() => setFormOpen(true))
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [assignee, setAssignee] = useState(ALL)
  const [typeId, setTypeId] = useState(ALL)
  const [zoneId, setZoneId] = useState(ALL)
  const zones = useZones()
  const [sort, setSort] = useState('recent')

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [searchInput])

  const filtersActive = search !== '' || assignee !== ALL || typeId !== ALL || zoneId !== ALL || status !== ALL
  const resetFilters = () => {
    setSearchInput('')
    setSearch('')
    setAssignee(ALL)
    setTypeId(ALL)
    setZoneId(ALL)
    setStatus(ALL)
    setPage(1)
  }
  // « group:<id> » ou « agent:<id> »
  const [assigneeKind, assigneeId] = assignee === ALL ? [null, null] : assignee.split(':')

  const query = useQuery({
    queryKey: ['missions', { status, page, showInactive, search, assignee, typeId, zoneId, sort }],
    queryFn: async () =>
      (
        await api.get<PageOf<Mission>>('/missions', {
          params: {
            status: status === ALL ? undefined : status,
            includeInactive: showInactive || undefined,
            search: search || undefined,
            groupId: assigneeKind === 'group' ? assigneeId : undefined,
            agentId: assigneeKind === 'agent' ? assigneeId : undefined,
            typeId: typeId === ALL ? undefined : typeId,
            zoneId: zoneId === ALL ? undefined : zoneId,
            sort: sort === 'recent' ? undefined : sort,
            page,
            limit: 24,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  })
  // Compteurs par statut : une requête légère par statut (seul le total est lu).
  const counts = useQueries({
    queries: Object.values(MissionStatus).map((s) => ({
      queryKey: ['missions', 'count', s, showInactive],
      queryFn: async () =>
        (await api.get<PageOf<Mission>>('/missions', { params: { status: s, includeInactive: showInactive || undefined, limit: 1 } })).data
          .total,
    })),
  })
  const items = query.data?.items ?? []
  const pages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.limit)) : 1

  const assigneeOf = (m: Mission) =>
    m.assigneeAgentId
      ? { icon: UserIcon, label: fullName(agents.data?.find((a) => a.id === m.assigneeAgentId)) }
      : m.assigneeGroupId
        ? { icon: UsersRound, label: groups.data?.find((g) => g.id === m.assigneeGroupId)?.name ?? 'Groupe' }
        : { icon: Globe, label: 'Ouverte à tous' }

  return (
    <Page>
      <PageHeader
        title="Missions"
        description="Objectifs assignés aux agents et aux groupes, et leur avancement."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus aria-hidden /> Nouvelle mission
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" role="group" aria-label="Filtrer par statut">
        {Object.values(MissionStatus).map((s, i) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => {
              setStatus(status === s ? ALL : s)
              setPage(1)
            }}
            className={cn(
              'relative overflow-hidden rounded-lg border bg-card p-3 pl-4 text-left transition-colors hover:bg-muted',
              status === s && 'border-primary ring-2 ring-primary/20',
            )}
          >
            <span className={cn('absolute inset-y-0 left-0 w-1', STATUS_BAR[s])} aria-hidden />
            <span className="block text-2xl leading-tight font-semibold tabular-nums">{counts[i].data ?? '—'}</span>
            <span className="text-sm text-muted-foreground">{missionStatusLabel[s]}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mission-search">Recherche</Label>
          <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Titre de la mission" label="Rechercher une mission" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Assignée à</Label>
          <Select
            value={assignee}
            onValueChange={(v) => {
              setAssignee(v ?? ALL)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full" aria-label="Assignée à">
              <SelectValue>
                {(v: string) => {
                  if (v === ALL) return 'Tous'
                  const [kind, id] = v.split(':')
                  return kind === 'group' ? groups.data?.find((g) => g.id === id)?.name : fullName(agents.data?.find((a) => a.id === id))
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {groups.data?.map((g) => (
                <SelectItem key={g.id} value={`group:${g.id}`}>
                  Groupe · {g.name}
                </SelectItem>
              ))}
              {agents.data?.map((a) => (
                <SelectItem key={a.id} value={`agent:${a.id}`}>
                  {fullName(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Type</Label>
          <Select
            value={typeId}
            onValueChange={(v) => {
              setTypeId(v ?? ALL)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full" aria-label="Type de mission">
              <SelectValue>{(v: string) => (v === ALL ? 'Tous les types' : types.data?.find((t) => t.id === v)?.name)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les types</SelectItem>
              {types.data?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Zone</Label>
          <Select
            value={zoneId}
            onValueChange={(v) => {
              setZoneId(v ?? ALL)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full" aria-label="Zone">
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
          <Label>Trier par</Label>
          <Select
            value={sort}
            onValueChange={(v) => {
              setSort(v ?? 'recent')
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full" aria-label="Trier par">
              <SelectValue>{(v: string) => SORT[v]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORT).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch
            size="sm"
            checked={showInactive}
            onCheckedChange={(v) => {
              setShowInactive(v)
              setPage(1)
            }}
          />
          Afficher les missions désactivées
        </label>
        {filtersActive && query.data && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            {query.data.total} mission{query.data.total > 1 ? 's' : ''}
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X aria-hidden /> Effacer les filtres
            </Button>
          </span>
        )}
      </div>

      <QueryState query={query}>
        {items.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Aucune mission"
            description={
              filtersActive
                ? 'Aucune mission ne correspond à ces filtres.'
                : 'Créez une mission pour fixer un objectif à un agent ou à un groupe.'
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((m) => {
              const who = assigneeOf(m)
              return (
                <Link
                  key={m.id}
                  to={`/missions/${m.id}`}
                  className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/[0.02] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-balance">{m.title}</h2>
                    {m.isActive ? (
                      <MissionStatusPill status={m.status} />
                    ) : (
                      <StatusPill tone="ended" icon={CircleSlash} label="Désactivée" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium tabular-nums">
                        {formatNumber(m.progress.current)} / {formatNumber(m.progress.target)}
                      </span>
                      <span className="text-muted-foreground tabular-nums">{m.progress.percent} %</span>
                    </div>
                    <Progress value={m.progress.percent} aria-label={`Progression : ${m.progress.percent} %`} />
                    <span className="text-xs text-muted-foreground">{progressMethodLabel[m.progressMethod]}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <who.icon className="size-3.5" aria-hidden /> {who.label}
                    </span>
                    {!!m.zones?.length && (
                      <span className="flex items-center gap-1">
                        <MapPinned className="size-3.5" aria-hidden /> {m.zones.map((z) => z.name).join(', ')}
                      </span>
                    )}
                    {m.dueDate && (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="size-3.5" aria-hidden /> {formatDate(m.dueDate)}
                      </span>
                    )}
                    {m.hasOwnPay && (
                      <span className="flex items-center gap-1">
                        <Coins className="size-3.5" aria-hidden /> Paie propre
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
        {query.data && <Pagination page={page} pages={pages} total={query.data.total} pageSize={query.data.limit} onPage={setPage} />}
      </QueryState>
      <MissionFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </Page>
  )
}
