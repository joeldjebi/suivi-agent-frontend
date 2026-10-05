import { DayEndReason, DayStatus } from '@suivi/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, History, Route } from 'lucide-react'
import { Fragment, useState } from 'react'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { DayStatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDate, formatDuration, formatTime, fullName } from '@/lib/format'
import { dayStatusLabel } from '@/lib/labels'
import { useAgents, useGroups, useZones } from '@/lib/queries'
import type { Page as PageOf, WorkDay } from '@/lib/types'
import { TrackDialog } from './TrackDialog'
import { ExportButton } from '@/components/app/export-button'

const ALL = 'all'

export function HistoryPage() {
  const { settings } = useMe()
  const agents = useAgents()
  const groups = useGroups()
  const zones = useZones(true)
  const [agentId, setAgentId] = useState(ALL)
  const [groupId, setGroupId] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [trackDay, setTrackDay] = useState<WorkDay | null>(null)

  const query = useQuery({
    queryKey: ['days', { agentId, groupId, status, from, to, page }],
    queryFn: async () =>
      (
        await api.get<PageOf<WorkDay>>('/days', {
          params: {
            agentId: agentId === ALL ? undefined : agentId,
            groupId: groupId === ALL ? undefined : groupId,
            status: status === ALL ? undefined : status,
            from: from || undefined,
            to: to || undefined,
            page,
            limit: 25,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  })
  const items = query.data?.items ?? []
  const pages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.limit)) : 1
  const reset = () => setPage(1)
  const tz = settings.timezone
  // Export : la période filtrée, sinon le mois en cours jusqu'à aujourd'hui.
  const todayIso = new Date().toISOString().slice(0, 10)
  const monthStart = `${todayIso.slice(0, 8)}01`
  const exportFrom = from || (to ? `${to.slice(0, 8)}01` : monthStart)
  const exportTo = to || (from && from > todayIso ? from : todayIso)

  return (
    <Page>
      <PageHeader
        title="Historique des journées"
        description="Heure de début, pauses et heure de fin de chaque agent."
        actions={
          <ExportButton
            path="/exports/days"
            params={{
              from: exportFrom,
              to: exportTo,
              agentId: agentId === ALL ? undefined : agentId,
              groupId: groupId === ALL ? undefined : groupId,
            }}
            description={`Journées du ${formatDate(exportFrom)} au ${formatDate(exportTo)}${
              agentId !== ALL || groupId !== ALL ? ', avec les filtres agent et groupe' : ''
            }`}
          />
        }
      />

      <div className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1.5">
          <Label>Agent</Label>
          <Select
            value={agentId}
            onValueChange={(v) => {
              setAgentId(v ?? ALL)
              reset()
            }}
          >
            <SelectTrigger className="w-full" aria-label="Agent">
              <SelectValue>{(v: string) => (v === ALL ? 'Tous les agents' : fullName(agents.data?.find((a) => a.id === v)))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les agents</SelectItem>
              {agents.data?.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {fullName(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {settings.useGroups && (
          <div className="flex flex-col gap-1.5">
            <Label>Groupe</Label>
            <Select
              value={groupId}
              onValueChange={(v) => {
                setGroupId(v ?? ALL)
                reset()
              }}
            >
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
          <Label>Statut</Label>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v ?? ALL)
              reset()
            }}
          >
            <SelectTrigger className="w-full" aria-label="Statut">
              <SelectValue>{(v: string) => (v === ALL ? 'Tous les statuts' : dayStatusLabel[v as DayStatus])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les statuts</SelectItem>
              {Object.values(DayStatus).map((s) => (
                <SelectItem key={s} value={s}>
                  {dayStatusLabel[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="from">Du</Label>
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              reset()
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="to">Au</Label>
          <Input
            id="to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value)
              reset()
            }}
          />
        </div>
      </div>

      <QueryState query={query}>
        {items.length === 0 ? (
          <EmptyState icon={History} title="Aucune journée" description="Aucune journée ne correspond à ces filtres." />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <span className="sr-only">Détail</span>
                  </TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Début</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead className="text-right">Travaillé</TableHead>
                  <TableHead className="text-right">Pauses</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>
                    <span className="sr-only">Trajet</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((d) => (
                  <Fragment key={d.id}>
                    <TableRow>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-expanded={expanded === d.id}
                          aria-label={`Détail des pauses (${d.pauses.length})`}
                          disabled={!d.pauses.length}
                          onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                        >
                          {expanded === d.id ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{fullName(d.agent)}</TableCell>
                      <TableCell>{formatDate(d.workDate)}</TableCell>
                      <TableCell>{zones.data?.find((z) => z.id === d.zoneId)?.name ?? '—'}</TableCell>
                      <TableCell className="tabular-nums">{formatTime(d.startedAt, tz)}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatTime(d.endedAt, tz)}
                        {d.endReason === DayEndReason.AutoReset && (
                          <span className="block text-xs text-muted-foreground">fin automatique</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatDuration(d.workedSeconds)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.pauses.length ? `${d.pauses.length} · ${formatDuration(d.pausedSeconds)}` : '—'}
                      </TableCell>
                      <TableCell>
                        <DayStatusPill status={d.status} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setTrackDay(d)}>
                          <Route aria-hidden /> Trajet
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expanded === d.id && (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell />
                        <TableCell colSpan={9}>
                          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                            {d.pauses.map((p, i) => (
                              <li key={p.id} className="tabular-nums">
                                Pause {i + 1} : {formatTime(p.startedAt, tz)} → {p.endedAt ? formatTime(p.endedAt, tz) : 'en cours'}
                              </li>
                            ))}
                          </ul>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Précédent
            </Button>
            <span className="tabular-nums text-muted-foreground">
              Page {page} / {pages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Suivant
            </Button>
          </div>
        )}
      </QueryState>
      <TrackDialog day={trackDay} onClose={() => setTrackDay(null)} />
    </Page>
  )
}
