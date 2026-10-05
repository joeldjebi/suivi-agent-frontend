import { useQuery } from '@tanstack/react-query'
import { Polygon, Tooltip as MapTooltip } from 'react-leaflet'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { QueryState } from '@/components/app/page'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BaseMap, FitZones } from '@/components/map/base-map'
import { toLatLngs } from '@/components/map/geo'
import { Card, Kpi } from '@/features/stats/components'
import { formatDate, formatNumber } from '@/lib/format'
import { missionStatusLabel } from '@/lib/labels'
import type { Zone } from '@/lib/types'
import { cn } from '@/lib/utils'
import { CalendarDays, Clock, ClipboardList, Radio } from 'lucide-react'
import type { MissionStatus } from '@suivi/shared'
import { platformApi } from '../api'
import type { TenantField } from '../types'

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))

/** Couleurs validées (contraste, daltonisme) : journées et agents présents. */
const SERIES = { days: '#2563eb', agents: '#0d9488' }

/**
 * Terrain : zones et leur occupation, activité quotidienne, missions. Lecture seule ;
 * les positions des agents ne sont jamais montrées à l'éditeur.
 */
export function FieldTab({ tenantId }: { tenantId: string }) {
  const query = useQuery({
    queryKey: ['platform', 'tenant', tenantId, 'field'],
    queryFn: async () => (await platformApi.get<TenantField>(`/tenants/${tenantId}/field`)).data,
  })
  const f = query.data
  return (
    <QueryState query={query} rows={6}>
      {f && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={Radio} label="En journée maintenant" value={formatNumber(f.days.workingNow)} />
            <Kpi
              icon={CalendarDays}
              label="Journées (30 j)"
              value={formatNumber(f.days.days30)}
              hint={`${f.days.autoClosed30} terminées automatiquement`}
            />
            <Kpi
              icon={Clock}
              label="Durée moyenne"
              value={formatNumber(f.days.avgHours30)}
              suffix="h"
              hint="Journées terminées, 30 derniers jours"
            />
            <Kpi
              icon={ClipboardList}
              label="Formulaires (30 j)"
              value={formatNumber(f.missions.forms30)}
              hint={`${f.missions.rejected30} rejeté${f.missions.rejected30 > 1 ? 's' : ''}`}
            />
          </div>

          <Card title="Activité quotidienne, 30 derniers jours">
            <div style={{ height: 240 }} role="img" aria-label="Graphique : journées de travail et agents présents par jour">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={f.daily.map((d) => ({ ...d, label: dayLabel(d.date) }))}
                  margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
                  barGap={2}
                >
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" minTickGap={16} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
                    contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="days" name="Journées" fill={SERIES.days} radius={[4, 4, 0, 0]} maxBarSize={14} />
                  <Bar dataKey="agents" name="Agents présents" fill={SERIES.agents} radius={[4, 4, 0, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Card title={`Zones (${f.zones.length})`} flush>
              {f.zones.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Aucune zone dessinée.</p>
              ) : (
                <div className="h-80">
                  <BaseMap>
                    <FitZones zones={f.zones as unknown as Zone[]} />
                    {f.zones.map((z) => (
                      <Polygon
                        key={z.id}
                        positions={toLatLngs(z.area)}
                        pathOptions={{
                          color: z.isActive ? (z.sensitive ? '#d97706' : '#2563eb') : '#94a3b8',
                          dashArray: z.isActive ? undefined : '6 6',
                          weight: 2,
                          fillOpacity: z.isActive ? 0.12 : 0.03,
                        }}
                      >
                        <MapTooltip sticky>
                          {z.name} · {z.workingNow} en journée
                        </MapTooltip>
                      </Polygon>
                    ))}
                  </BaseMap>
                </div>
              )}
            </Card>
            <Card title="Occupation des zones" flush>
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zone</TableHead>
                      <TableHead className="text-right">Places</TableHead>
                      <TableHead className="text-right">Maintenant</TableHead>
                      <TableHead className="text-right">30 j</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {f.zones.map((z) => (
                      <TableRow key={z.id} className={cn(!z.isActive && 'text-muted-foreground')}>
                        <TableCell>
                          <span className="font-medium">{z.name}</span>
                          <span className="ml-1.5 inline-flex gap-1">
                            {z.sensitive && <Badge variant="outline">Sensible</Badge>}
                            {z.restricted && <Badge variant="outline">Réservée</Badge>}
                            {!z.isActive && <Badge variant="secondary">Désactivée</Badge>}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{z.capacity ?? '∞'}</TableCell>
                        <TableCell className="text-right tabular-nums">{z.workingNow}</TableCell>
                        <TableCell className="text-right tabular-nums">{z.days30}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          <Card
            title="Missions"
            actions={
              <p className="text-sm text-muted-foreground">
                {f.missions.active} active{f.missions.active > 1 ? 's' : ''} · {f.missions.achieved} atteinte
                {f.missions.achieved > 1 ? 's' : ''} · {f.missions.late} en retard · {f.missions.types} type
                {f.missions.types > 1 ? 's' : ''}
              </p>
            }
            flush
          >
            {f.recentMissions.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Aucune mission.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mission</TableHead>
                      <TableHead>Assignée à</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Échéance</TableHead>
                      <TableHead className="text-right">Formulaires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {f.recentMissions.map((m) => (
                      <TableRow key={m.id} className={cn(!m.isActive && 'text-muted-foreground')}>
                        <TableCell>
                          <p className="font-medium">{m.title}</p>
                          <p className="text-xs text-muted-foreground">{m.typeName}</p>
                        </TableCell>
                        <TableCell className="text-sm">{m.assignee ?? '—'}</TableCell>
                        <TableCell className="text-sm">{missionStatusLabel[m.status as MissionStatus] ?? m.status}</TableCell>
                        <TableCell className="text-sm">{m.dueDate ? formatDate(m.dueDate) : '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.submissions}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
          <p className="text-xs text-muted-foreground">Les positions des agents ne sont jamais accessibles depuis la console éditeur.</p>
        </div>
      )}
    </QueryState>
  )
}
