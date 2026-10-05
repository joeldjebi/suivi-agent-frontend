import { useQuery } from '@tanstack/react-query'
import { AlarmClock, AlertTriangle, CalendarDays, Clock, FileText, Footprints, Filter } from 'lucide-react'
import { useMemo } from 'react'
import { QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatDuration, formatNumber, fullName } from '@/lib/format'
import { usePaged } from '@/lib/pagination'
import type { StatsOverview } from '@/lib/types'
import { Chart, Kpi, clock, dayLabel, hours, percent } from './components'

/** Élément dont on veut le détail : un groupe, une zone, un agent ou une journée. */
export interface StatsTarget {
  title: string
  subtitle: string
  from: string
  to: string
  groupId?: string
  agentId?: string
  zoneId?: string
}

/** Statistiques d'un seul élément, sur la même période que la page. */
export function StatsDetailSheet({
  target,
  onClose,
  onApply,
}: {
  target: StatsTarget | null
  onClose: () => void
  /** Filtrer toute la page sur cet élément. */
  onApply?: (target: StatsTarget) => void
}) {
  const query = useQuery({
    queryKey: ['stats', 'detail', target],
    enabled: !!target,
    queryFn: async () =>
      (
        await api.get<StatsOverview>('/stats/overview', {
          params: { from: target!.from, to: target!.to, groupId: target!.groupId, agentId: target!.agentId, zoneId: target!.zoneId },
        })
      ).data,
  })
  const d = query.data
  const daily = useMemo(() => (d?.daily ?? []).map((x) => ({ label: dayLabel(x.date), hours: hours(x.workedSeconds) })), [d])
  const agents = usePaged(d?.agents ?? [], 8)
  const zones = usePaged(
    (d?.zones ?? []).filter((z) => z.days > 0),
    8,
  )
  const k = d?.kpis

  return (
    <Sheet open={!!target} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{target?.title}</SheetTitle>
          <SheetDescription>{target?.subtitle}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          {target && onApply && (target.groupId || target.agentId || target.zoneId) && (
            <Button variant="outline" size="sm" className="w-fit" onClick={() => onApply(target)}>
              <Filter aria-hidden /> Filtrer toute la page sur cet élément
            </Button>
          )}
          <QueryState query={query} rows={6}>
            {d && k && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Kpi
                    icon={CalendarDays}
                    label="Journées"
                    value={formatNumber(k.days)}
                    hint={`${k.activeAgents} agent${k.activeAgents > 1 ? 's' : ''} actif${k.activeAgents > 1 ? 's' : ''}`}
                  />
                  <Kpi
                    icon={Clock}
                    label="Temps travaillé"
                    value={formatDuration(k.workedSeconds)}
                    hint={`${k.days ? formatDuration(k.workedSeconds / k.days) : '—'} par journée`}
                  />
                  <Kpi
                    icon={FileText}
                    label="Formulaires"
                    value={formatNumber(k.forms)}
                    hint={`${k.formsRejected} rejeté${k.formsRejected > 1 ? 's' : ''}`}
                  />
                  <Kpi
                    icon={Footprints}
                    label="Distance"
                    value={`${formatNumber(k.distanceKm)} km`}
                    hint={`${k.days ? formatNumber(Math.round((k.distanceKm / k.days) * 10) / 10) : 0} km par journée`}
                  />
                  <Kpi
                    icon={AlarmClock}
                    label="Début moyen"
                    value={clock(k.avgStartMinutes)}
                    hint={`${k.autoClosedDays} journée${k.autoClosedDays > 1 ? 's' : ''} non clôturée${k.autoClosedDays > 1 ? 's' : ''}`}
                  />
                  <Kpi
                    icon={AlertTriangle}
                    label="Hors zone"
                    value={`${formatNumber(percent(k.outsidePositions, k.positions))} %`}
                    hint={`${formatNumber(k.mockedPositions)} position${k.mockedPositions > 1 ? 's' : ''} simulée${k.mockedPositions > 1 ? 's' : ''}`}
                  />
                </div>

                {daily.length > 1 && (
                  <section className="rounded-lg border bg-card p-4">
                    <h3 className="mb-2 text-sm font-semibold">Heures travaillées par jour</h3>
                    <Chart data={daily} dataKey="hours" name="Heures travaillées" height={200} />
                  </section>
                )}

                {!target?.agentId && d.agents.length > 0 && (
                  <section className="rounded-lg border bg-card">
                    <h3 className="border-b px-4 py-3 text-sm font-semibold">Agents ({d.agents.length})</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Agent</TableHead>
                          <TableHead className="text-right">Journées</TableHead>
                          <TableHead className="text-right">Temps</TableHead>
                          <TableHead className="text-right">Formulaires</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {agents.items.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium">{fullName(a)}</TableCell>
                            <TableCell className="text-right tabular-nums">{a.days}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatDuration(a.workedSeconds)}</TableCell>
                            <TableCell className="text-right tabular-nums">{a.forms}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="px-4 py-2">
                      <Pagination
                        page={agents.page}
                        pages={agents.pages}
                        total={agents.total}
                        pageSize={agents.pageSize}
                        onPage={agents.setPage}
                      />
                    </div>
                  </section>
                )}

                {!target?.zoneId && zones.total > 0 && (
                  <section className="rounded-lg border bg-card">
                    <h3 className="border-b px-4 py-3 text-sm font-semibold">Zones travaillées ({zones.total})</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Zone</TableHead>
                          <TableHead className="text-right">Journées</TableHead>
                          <TableHead className="text-right">Temps</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {zones.items.map((z) => (
                          <TableRow key={z.id}>
                            <TableCell className="font-medium">{z.name}</TableCell>
                            <TableCell className="text-right tabular-nums">{z.days}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatDuration(z.workedSeconds)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="px-4 py-2">
                      <Pagination
                        page={zones.page}
                        pages={zones.pages}
                        total={zones.total}
                        pageSize={zones.pageSize}
                        onPage={zones.setPage}
                      />
                    </div>
                  </section>
                )}
              </>
            )}
          </QueryState>
        </div>
      </SheetContent>
    </Sheet>
  )
}
