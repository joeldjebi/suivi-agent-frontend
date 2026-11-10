import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Bot, Gauge, KeyRound, Lock, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SECURITY_EVENT_TYPE_HINTS, SECURITY_EVENT_TYPE_LABELS, SecurityEventType } from '@suivi/shared'
import type { LucideIcon } from 'lucide-react'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, Chart, Kpi } from '@/features/stats/components'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { platformApi } from '../api'
import type { Paged, SecurityEvent, SecuritySummary } from '../types'

const PAGE_SIZE = 50

/** Ordre et icône de chaque type d'attaque. */
const TYPES: { type: string; icon: LucideIcon }[] = [
  { type: SecurityEventType.LoginFailed, icon: KeyRound },
  { type: SecurityEventType.LoginLocked, icon: Lock },
  { type: SecurityEventType.RateLimited, icon: Gauge },
  { type: SecurityEventType.CaptchaFailed, icon: ShieldAlert },
  { type: SecurityEventType.Honeypot, icon: Bot },
]

const typeLabel = (type: string) => SECURITY_EVENT_TYPE_LABELS[type as SecurityEventType] ?? type
const dayShort = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function SecurityPage() {
  const [type, setType] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const summary = useQuery({
    queryKey: ['platform', 'security', 'summary'],
    queryFn: async () => (await platformApi.get<SecuritySummary>('/security-events/summary')).data,
    refetchInterval: 60_000,
  })

  const list = useQuery({
    queryKey: ['platform', 'security', 'list', type, search, page],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await platformApi.get<Paged<SecurityEvent>>('/security-events', {
          params: { page, limit: PAGE_SIZE, type: type === 'all' ? undefined : type, search: search || undefined },
        })
      ).data,
  })

  const counts = useMemo(() => {
    const by = new Map(summary.data?.byType.map((r) => [r.type, r]) ?? [])
    return TYPES.map((t) => ({ ...t, last24h: by.get(t.type)?.last24h ?? 0, last7d: by.get(t.type)?.last7d ?? 0 }))
  }, [summary.data])

  const total24h = counts.reduce((s, c) => s + c.last24h, 0)

  // Série du graphe : total des attaques par jour (14 derniers jours).
  const chartData = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const r of summary.data?.daily ?? []) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.count)
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ label: dayShort(day), value }))
  }, [summary.data])

  const data = list.data
  const onFilter = (next: () => void) => {
    setPage(1)
    next()
  }

  return (
    <Page>
      <PageHeader
        title="Sécurité"
        description="Les tentatives d’attaque sur la plateforme : mots de passe refusés, verrouillages, dépassements de débit, échecs du CAPTCHA et robots."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi
          icon={total24h > 0 ? ShieldAlert : ShieldCheck}
          label="Attaques (24 h)"
          value={String(total24h)}
          tone={total24h > 0 ? 'text-status-alert' : 'text-status-active'}
          hint={total24h > 0 ? 'Tentatives bloquées sur les dernières 24 h' : 'Rien à signaler sur les dernières 24 h'}
        />
        {counts.map((c) => (
          <Kpi key={c.type} icon={c.icon} label={typeLabel(c.type)} value={String(c.last7d)} suffix="sur 7 j" hint={`${c.last24h} sur 24 h`} />
        ))}
      </div>

      <Card title="Attaques par jour (14 jours)">
        <Chart data={chartData} dataKey="value" name="Attaques" color="var(--status-alert, var(--primary))" />
      </Card>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card
          title="Dernières attaques"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={type} onValueChange={(v: string | null) => onFilter(() => setType(v ?? 'all'))}>
                <SelectTrigger className="h-9 w-[11rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {TYPES.map((t) => (
                    <SelectItem key={t.type} value={t.type}>
                      {typeLabel(t.type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-9 w-[12rem]"
                placeholder="IP ou cible…"
                value={search}
                onChange={(e) => onFilter(() => setSearch(e.target.value))}
              />
            </div>
          }
          flush
        >
          <QueryState query={list} rows={10}>
            {data && data.items.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="Aucune attaque" />
            ) : (
              data && (
                <div className={cn(list.isFetching && 'opacity-70')}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Adresse IP</TableHead>
                        <TableHead>Cible</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-sm whitespace-nowrap tabular-nums">{formatDateTime(e.createdAt)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" title={SECURITY_EVENT_TYPE_HINTS[e.type as SecurityEventType]}>
                              {typeLabel(e.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{e.ip ?? '—'}</TableCell>
                          <TableCell className="max-w-xs truncate text-sm" title={e.target ?? undefined}>
                            {e.target ?? '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            )}
          </QueryState>
          {data && (
            <Pagination
              page={data.page}
              pages={Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
              total={data.total}
              pageSize={PAGE_SIZE}
              onPage={setPage}
            />
          )}
        </Card>

        <Card title="Adresses les plus actives (7 j)">
          {summary.data && summary.data.topIps.length > 0 ? (
            <ul className="divide-y text-sm">
              {summary.data.topIps.map((r) => (
                <li key={r.ip} className="flex items-center justify-between gap-2 py-2">
                  <button
                    type="button"
                    className="truncate font-mono text-xs hover:underline"
                    onClick={() => onFilter(() => setSearch(r.ip))}
                    title="Filtrer sur cette adresse"
                  >
                    {r.ip}
                  </button>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{r.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucune adresse sur 7 jours.</p>
          )}
        </Card>
      </div>
    </Page>
  )
}
