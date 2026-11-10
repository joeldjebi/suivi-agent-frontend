import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Bot, Gauge, Globe, KeyRound, Lock, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SECURITY_EVENT_TYPE_HINTS, SECURITY_EVENT_TYPE_LABELS, SecurityEventType } from '@suivi/shared'
import type { LucideIcon } from 'lucide-react'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, Chart, Kpi } from '@/features/stats/components'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { platformApi } from '../api'
import type { Attacker, IpIntel, Paged, SecurityEvent, SecuritySummary } from '../types'

const PAGE_SIZE = 50

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

/** Code pays « CI » → drapeau emoji 🇨🇮. */
function flag(country: string | null | undefined): string {
  if (!country || country.length !== 2) return '🌐'
  return String.fromCodePoint(...[...country.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

/** Lieu lisible à partir des infos d'IP : « 🇨🇮 Abidjan · Orange CI ». */
function place(intel: IpIntel | null | undefined): string | null {
  if (!intel || (!intel.country && !intel.org)) return null
  const where = [intel.city, intel.region, intel.country].filter(Boolean).join(', ')
  return `${flag(intel.country)} ${[where, intel.org].filter(Boolean).join(' · ')}`.trim()
}

/** Petit décodage du user-agent : navigateur et système, sans dépendance. */
function parseUa(ua: string | null): string | null {
  if (!ua) return null
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /curl|python|bot|wget|Go-http/i.test(ua) ? 'Robot/script' : null
  return [br, os].filter(Boolean).join(' · ') || null
}

export function SecurityPage() {
  const [tab, setTab] = useState<'events' | 'attackers'>('events')
  const [type, setType] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)

  const summary = useQuery({
    queryKey: ['platform', 'security', 'summary'],
    queryFn: async () => (await platformApi.get<SecuritySummary>('/security-events/summary')).data,
    refetchInterval: 60_000,
  })

  const list = useQuery({
    queryKey: ['platform', 'security', 'list', type, search, page],
    enabled: tab === 'events',
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await platformApi.get<Paged<SecurityEvent>>('/security-events', {
          params: { page, limit: PAGE_SIZE, type: type === 'all' ? undefined : type, search: search || undefined },
        })
      ).data,
  })

  const attackers = useQuery({
    queryKey: ['platform', 'security', 'attackers'],
    enabled: tab === 'attackers',
    placeholderData: keepPreviousData,
    queryFn: async () => (await platformApi.get<Paged<Attacker>>('/security-events/attackers', { params: { days: 7, limit: 50 } })).data,
  })

  const detail = useQuery({
    queryKey: ['platform', 'security', 'detail', openId],
    enabled: !!openId,
    queryFn: async () => (await platformApi.get<SecurityEvent>(`/security-events/${openId}`)).data,
  })

  const counts = useMemo(() => {
    const by = new Map(summary.data?.byType.map((r) => [r.type, r]) ?? [])
    return TYPES.map((t) => ({ ...t, last24h: by.get(t.type)?.last24h ?? 0, last7d: by.get(t.type)?.last7d ?? 0 }))
  }, [summary.data])

  const total24h = counts.reduce((s, c) => s + c.last24h, 0)

  const chartData = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const r of summary.data?.daily ?? []) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.count)
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ label: dayShort(day), value }))
  }, [summary.data])

  const onFilter = (next: () => void) => {
    setPage(1)
    next()
  }
  const focusIp = (ip: string) => {
    onFilter(() => setSearch(ip))
    setType('all')
    setTab('events')
  }

  const data = list.data

  return (
    <Page>
      <PageHeader
        title="Sécurité"
        description="Les tentatives d’attaque sur la plateforme : mots de passe refusés, verrouillages, dépassements de débit, échecs du CAPTCHA et robots. Cliquez une ligne pour le détail."
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

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'events' | 'attackers')}>
        <TabsList>
          <TabsTrigger value="events">Événements</TabsTrigger>
          <TabsTrigger value="attackers">Attaquants (par IP)</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'events' ? (
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
              <Input className="h-9 w-[12rem]" placeholder="IP ou cible…" value={search} onChange={(e) => onFilter(() => setSearch(e.target.value))} />
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
                        <TableHead>Origine</TableHead>
                        <TableHead>Cible</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((e) => (
                        <TableRow key={e.id} className="cursor-pointer" onClick={() => setOpenId(e.id)}>
                          <TableCell className="text-sm whitespace-nowrap tabular-nums">{formatDateTime(e.createdAt)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" title={SECURITY_EVENT_TYPE_HINTS[e.type as SecurityEventType]}>
                              {typeLabel(e.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{e.ip ?? '—'}</TableCell>
                          <TableCell className="max-w-[14rem] truncate text-sm">{place(e.intel) ?? '—'}</TableCell>
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
            <Pagination page={data.page} pages={Math.max(1, Math.ceil(data.total / PAGE_SIZE))} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} />
          )}
        </Card>
      ) : (
        <Card title="Attaquants des 7 derniers jours" flush>
          <QueryState query={attackers} rows={10}>
            {attackers.data && attackers.data.items.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="Aucun attaquant" />
            ) : (
              attackers.data && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Adresse IP</TableHead>
                      <TableHead>Origine</TableHead>
                      <TableHead className="text-right">Tentatives</TableHead>
                      <TableHead>Types</TableHead>
                      <TableHead>Dernière</TableHead>
                      <TableHead>Cibles</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attackers.data.items.map((a) => (
                      <TableRow key={a.ip} className="cursor-pointer" onClick={() => focusIp(a.ip)}>
                        <TableCell className="font-mono text-xs">{a.ip}</TableCell>
                        <TableCell className="max-w-[16rem] truncate text-sm" title={a.intel?.hostname ?? undefined}>
                          {place(a.intel) ?? '—'}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{a.count}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {a.types.map((t) => (
                              <Badge key={t} variant="outline" className="text-xs">
                                {typeLabel(t)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap tabular-nums">{formatDateTime(a.lastSeen)}</TableCell>
                        <TableCell className="max-w-[12rem] truncate text-xs text-muted-foreground" title={a.targets.join(', ')}>
                          {a.targets.join(', ') || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            )}
          </QueryState>
        </Card>
      )}

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Détail de l’attaque</DialogTitle>
            <DialogDescription>Tout ce qu’on sait sur cette tentative et son origine.</DialogDescription>
          </DialogHeader>
          {detail.data && <EventDetail event={detail.data} />}
        </DialogContent>
      </Dialog>
    </Page>
  )
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn('text-sm break-words', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  )
}

function EventDetail({ event }: { event: SecurityEvent }) {
  const intel = event.intel
  return (
    <dl className="divide-y">
      <Row label="Type" value={typeLabel(event.type)} />
      <Row label="Date" value={formatDateTime(event.createdAt)} />
      <Row label="Adresse IP" value={event.ip} mono />
      {intel && (place(intel) || intel.hostname) && (
        <Row
          label="Origine"
          value={
            <span className="inline-flex items-center gap-1">
              <Globe className="size-3.5 text-muted-foreground" aria-hidden />
              {place(intel) ?? intel.hostname}
            </span>
          }
        />
      )}
      {intel?.hostname && <Row label="Hôte" value={intel.hostname} mono />}
      {intel?.timezone && <Row label="Fuseau" value={intel.timezone} />}
      <Row label="Cible" value={event.target} />
      <Row label="Méthode" value={event.method} mono />
      <Row label="Chemin" value={event.path} mono />
      <Row label="Referer" value={event.referer} mono />
      <Row label="Navigateur" value={parseUa(event.userAgent)} />
      <Row label="User-agent" value={event.userAgent} mono />
      {event.details && Object.keys(event.details).length > 0 && (
        <Row label="Détails" value={<code className="text-xs">{JSON.stringify(event.details)}</code>} />
      )}
    </dl>
  )
}
