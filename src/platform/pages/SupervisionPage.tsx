import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Bug,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  HardDrive,
  Loader2,
  MapPin,
  MemoryStick,
  RefreshCw,
  Server,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Page, PageHeader, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Card, Chart, Kpi } from '@/features/stats/components'
import { formatDateTime, formatDuration, formatNumber, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { platformApi } from '../api'
import { to } from '../config'

/** Bloc d'un outil externe : non configuré, en erreur, ou ses chiffres. */
type Bloc<T> = { configured: false } | { configured: true; error: string } | ({ configured: true; error?: undefined } & T)

interface Sonde {
  name: string
  url: string
  status: 'up' | 'down' | 'paused' | 'pending'
  uptime: { day: number | null; week: number | null; month: number | null }
  responseMs: number | null
  incidents: { at: string; durationS: number }[]
}

interface Supervision {
  generatedAt: string
  performx: {
    health: { status: 'ok' | 'down'; database: 'up' | 'down'; postgis: string | null; redis: 'up' | 'down' }
    apiUptimeS: number
    apiMemoryMb: number
    databaseMb: number | null
    databaseConnections: number | null
    redisMemoryMb: number | null
    activeDays: number | null
    positionsLastHour: number | null
    errorLog: { open: number; lastDay: number }
  }
  availability: Bloc<{ monitors: Sonde[] }>
  errors: Bloc<{
    url: string | null
    unresolved: number
    projects: { slug: string; name: string; unresolved: number }[]
    perDay: { date: string; count: number }[]
    top: { title: string; project: string; count: number; users: number; lastSeen: string; level: string; link: string }[]
  }>
  server: Bloc<{
    cpu: number | null
    ram: { usedPct: number; totalMb: number } | null
    disk: { usedPct: number; totalGb: number; availGb: number } | null
    load: { one: number; five: number; fifteen: number } | null
    uptimeS: number | null
  }>
}

/** Chiffres d'un outil, ou null s'il n'est pas relié ou pas lu. */
const lu = <T,>(b: Bloc<T>): T | null => (b.configured && !b.error ? (b as T) : null)

/** 1 000 000 s → « 11 j 13 h » ; en dessous d'un jour, « 3 h 05 ». */
function longDuration(seconds: number) {
  const days = Math.floor(seconds / 86400)
  return (days > 0 ? `${days} j ${Math.floor((seconds % 86400) / 3600)} h` : formatDuration(seconds)).replace(/ /g, '\u00a0')
}

const pct = (v: number | null) => (v === null ? '—' : `${formatNumber(v)} %`)
const mo = (v: number | null) => (v === null ? '—' : v >= 1024 ? `${formatNumber(Math.round(v / 102.4) / 10)} Go` : `${formatNumber(v)} Mo`)

/**
 * Supervision de la plateforme : état interne de PerformX et synthèse des outils de suivi
 * (UptimeRobot, Sentry, Netdata). Chaque outil est facultatif ; les chiffres externes sont
 * gardés 2 minutes par l'API, « Actualiser » les relit tout de suite.
 */
export function SupervisionPage() {
  const client = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const query = useQuery({
    queryKey: ['platform', 'supervision'],
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    queryFn: async () => (await platformApi.get<Supervision>('/supervision')).data,
  })
  const refresh = async () => {
    setRefreshing(true)
    try {
      const data = (await platformApi.get<Supervision>('/supervision', { params: { refresh: 1 } })).data
      client.setQueryData(['platform', 'supervision'], data)
    } finally {
      setRefreshing(false)
    }
  }
  const d = query.data

  return (
    <Page>
      <PageHeader
        title="Supervision"
        description={
          d
            ? `Disponibilité, erreurs et serveur de la plateforme · mis à jour ${formatRelative(d.generatedAt)}`
            : 'Disponibilité, erreurs et serveur de la plateforme'
        }
        actions={
          <Button variant="outline" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />} Actualiser
          </Button>
        }
      />
      <QueryState query={query} rows={6}>
        {d && <Content d={d} />}
      </QueryState>
    </Page>
  )
}

function Content({ d }: { d: Supervision }) {
  const p = d.performx
  const alerts = problems(d)
  return (
    <>
      <div
        role="status"
        className={cn(
          'flex items-start gap-3 rounded-lg border p-4',
          alerts.length === 0 ? 'border-status-active/30 bg-status-active/5' : 'border-status-alert/30 bg-status-alert/5',
        )}
      >
        {alerts.length === 0 ? (
          <CheckCircle2 className="size-5 shrink-0 text-status-active" aria-hidden />
        ) : (
          <AlertTriangle className="size-5 shrink-0 text-status-alert" aria-hidden />
        )}
        {alerts.length === 0 ? (
          <p className="text-sm font-medium">Tout fonctionne normalement.</p>
        ) : (
          <ul className="flex flex-col gap-0.5 text-sm">
            {alerts.map((a) => (
              <li key={a} className="font-medium">
                {a}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={Activity}
          label="Plateforme"
          value={p.health.status === 'ok' ? 'En service' : 'En panne'}
          tone={p.health.status === 'ok' ? 'text-status-active' : 'text-status-alert'}
          hint={`Base ${p.health.database === 'up' ? 'OK' : 'en panne'} · Redis ${p.health.redis === 'up' ? 'OK' : 'en panne'} · API depuis ${longDuration(p.apiUptimeS)}`}
        />
        <Kpi
          icon={Users}
          label="Agents en journée"
          value={p.activeDays === null ? '—' : formatNumber(p.activeDays)}
          hint="Toutes structures confondues"
        />
        <Kpi
          icon={MapPin}
          label="Positions reçues"
          value={p.positionsLastHour === null ? '—' : formatNumber(p.positionsLastHour)}
          hint="Dans la dernière heure"
        />
        <Kpi
          icon={Bug}
          label="Erreurs à traiter"
          value={formatNumber(p.errorLog.open)}
          tone={p.errorLog.open ? 'text-status-alert' : undefined}
          hint={`${p.errorLog.lastDay} ces dernières 24 h · journal interne`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Disponibilité" actions={<Source name="UptimeRobot" />} flush>
          <Block bloc={d.availability} tool="UptimeRobot" setting="UPTIMEROBOT_API_KEY">
            {(a) =>
              a.monitors.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Aucune surveillance dans le compte.</p>
              ) : (
                <ul className="divide-y">
                  {a.monitors.map((m) => (
                    <Monitor key={m.url + m.name} m={m} />
                  ))}
                </ul>
              )
            }
          </Block>
        </Card>

        <Card title="Serveur" actions={<Source name="Netdata" />}>
          <Block bloc={d.server} tool="Netdata" setting="NETDATA_URL" inset>
            {(s) => (
              <div className="flex flex-col gap-4">
                <Gauge icon={Cpu} label="Processeur" value={s.cpu} detail="Moyenne de la dernière minute" />
                <Gauge
                  icon={MemoryStick}
                  label="Mémoire"
                  value={s.ram?.usedPct ?? null}
                  detail={s.ram ? `${mo(s.ram.totalMb)} au total` : undefined}
                />
                <Gauge
                  icon={HardDrive}
                  label="Disque"
                  value={s.disk?.usedPct ?? null}
                  detail={s.disk ? `${formatNumber(s.disk.availGb)} Go libres sur ${formatNumber(s.disk.totalGb)} Go` : undefined}
                />
                <p className="text-xs text-muted-foreground">
                  {s.load &&
                    `Charge ${formatNumber(s.load.one)} · ${formatNumber(s.load.five)} · ${formatNumber(s.load.fifteen)} (1, 5, 15 min)`}
                  {s.load && s.uptimeS !== null && ' · '}
                  {s.uptimeS !== null && `allumé depuis ${longDuration(s.uptimeS)}`}
                </p>
              </div>
            )}
          </Block>
        </Card>
      </div>

      <Card
        title="Erreurs signalées"
        actions={
          lu(d.errors)?.url ? (
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<a href={lu(d.errors)!.url!} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink aria-hidden /> Ouvrir Sentry
            </Button>
          ) : (
            <Source name="Sentry" />
          )
        }
      >
        <Block bloc={d.errors} tool="Sentry" setting="SENTRY_AUTH_TOKEN et SENTRY_ORG" inset>
          {(e) => (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div className="flex flex-col gap-3">
                <p className="text-sm">
                  <span className={cn('text-2xl font-semibold tabular-nums', e.unresolved > 0 && 'text-status-alert')}>
                    {formatNumber(e.unresolved)}
                  </span>{' '}
                  <span className="text-muted-foreground">
                    erreur{e.unresolved > 1 ? 's' : ''} non résolue{e.unresolved > 1 ? 's' : ''}
                  </span>
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {e.projects.map((pr) => (
                    <li key={pr.slug} className="rounded-full border px-2.5 py-0.5 text-xs">
                      {pr.name} · <span className="font-medium tabular-nums">{pr.unresolved}</span>
                    </li>
                  ))}
                </ul>
                <p className="-mb-1 text-xs text-muted-foreground">Erreurs reçues par jour, 7 derniers jours</p>
                <Chart
                  data={e.perDay.map((x) => ({ label: `${x.date.slice(8, 10)}/${x.date.slice(5, 7)}`, count: x.count }))}
                  dataKey="count"
                  name="Erreurs reçues par jour, 7 derniers jours"
                  height={160}
                />
              </div>
              {e.top.length === 0 ? (
                <p className="self-center text-center text-sm text-muted-foreground">Aucune erreur en cours.</p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {e.top.map((i) => (
                    <li key={i.link} className="py-2 first:pt-0">
                      <a href={i.link} target="_blank" rel="noreferrer" className="font-medium break-words hover:underline">
                        {i.title}
                      </a>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {i.project} · <span className="tabular-nums">{formatNumber(i.count)}</span> fois
                        {i.users > 0 && ` · ${i.users} utilisateur${i.users > 1 ? 's' : ''}`} · dernière {formatRelative(i.lastSeen)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Block>
      </Card>

      <Card title="Ressources de PerformX">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <Fact
            icon={Database}
            label="Base de données"
            value={mo(p.databaseMb)}
            hint={p.health.postgis ? `PostGIS ${p.health.postgis}` : undefined}
          />
          <Fact
            icon={Database}
            label="Connexions à la base"
            value={p.databaseConnections === null ? '—' : formatNumber(p.databaseConnections)}
          />
          <Fact icon={MemoryStick} label="Mémoire Redis" value={mo(p.redisMemoryMb)} />
          <Fact icon={Server} label="Mémoire de l’API" value={mo(p.apiMemoryMb)} hint={`Démarrée il y a ${longDuration(p.apiUptimeS)}`} />
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Les erreurs internes se traitent dans le{' '}
          <Link to={to('/errors')} className="underline">
            journal des erreurs
          </Link>
          .
        </p>
      </Card>
    </>
  )
}

/** Résumé des points à surveiller, affiché en tête de page. */
function problems(d: Supervision) {
  const list: string[] = []
  const h = d.performx.health
  if (h.database !== 'up') list.push('La base de données ne répond pas.')
  if (h.redis !== 'up') list.push('Redis ne répond pas.')
  const a = lu(d.availability)
  if (a) {
    for (const m of a.monitors.filter((x) => x.status === 'down')) list.push(`${m.name} est injoignable.`)
  }
  const s = lu(d.server)
  if (s) {
    if ((s.cpu ?? 0) >= 90) list.push(`Processeur du serveur chargé à ${pct(s.cpu)}.`)
    if ((s.ram?.usedPct ?? 0) >= 90) list.push(`Mémoire du serveur utilisée à ${pct(s.ram!.usedPct)}.`)
    if ((s.disk?.usedPct ?? 0) >= 85) list.push(`Disque du serveur rempli à ${pct(s.disk!.usedPct)}.`)
  }
  for (const [name, b] of [
    ['UptimeRobot', d.availability],
    ['Sentry', d.errors],
    ['Netdata', d.server],
  ] as const) {
    if (b.configured && b.error) list.push(`${name} n’a pas pu être lu.`)
  }
  return list
}

function Source({ name }: { name: string }) {
  return <span className="text-xs text-muted-foreground">Source : {name}</span>
}

/** Contenu d'un outil externe, ou la raison de son absence. */
function Block<T>({
  bloc,
  tool,
  setting,
  inset,
  children,
}: {
  bloc: Bloc<T>
  tool: string
  setting: string
  inset?: boolean
  children: (data: T) => ReactNode
}) {
  if (!bloc.configured) {
    return (
      <p className={cn('text-sm text-muted-foreground', !inset && 'p-4')}>
        {tool} n’est pas relié. Renseignez {setting} dans le fichier .env du serveur, puis redéployez l’API.
      </p>
    )
  }
  if (bloc.error) {
    return (
      <p role="alert" className={cn('flex items-start gap-2 text-sm text-status-alert', !inset && 'p-4')}>
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Lecture de {tool} impossible : {bloc.error}
        </span>
      </p>
    )
  }
  return <>{children(bloc as T)}</>
}

const STATUS: Record<Sonde['status'], { label: string; dot: string; text: string }> = {
  up: { label: 'En ligne', dot: 'bg-status-active', text: 'text-status-active' },
  down: { label: 'Injoignable', dot: 'bg-status-alert', text: 'text-status-alert' },
  paused: { label: 'En pause', dot: 'bg-status-ended', text: 'text-muted-foreground' },
  pending: { label: 'En attente', dot: 'bg-status-paused', text: 'text-status-paused' },
}

function Monitor({ m }: { m: Sonde }) {
  const s = STATUS[m.status]
  const last = m.incidents[0]
  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">
          <span className={cn('size-2 shrink-0 rounded-full', s.dot)} aria-hidden />
          <span className="break-all">{m.name}</span>
          <span className={cn('text-xs font-normal', s.text)}>{s.label}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {m.responseMs !== null && `Réponse en ${formatNumber(m.responseMs)} ms · `}
          {last ? `Dernière coupure le ${formatDateTime(last.at)} (${longDuration(last.durationS)})` : 'Aucune coupure récente'}
        </p>
      </div>
      <dl className="flex gap-4 text-right text-xs">
        {(
          [
            ['24 h', m.uptime.day],
            ['7 j', m.uptime.week],
            ['30 j', m.uptime.month],
          ] as const
        ).map(([label, v]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={cn('font-medium tabular-nums', v !== null && v < 99 && 'text-status-alert')}>{pct(v)}</dd>
          </div>
        ))}
      </dl>
    </li>
  )
}

/** Jauge d'occupation : orange à 75 %, rouge à 90 %. */
function Gauge({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: number | null; detail?: string }) {
  const tone = value === null ? 'bg-muted' : value >= 90 ? 'bg-status-alert' : value >= 75 ? 'bg-status-paused' : 'bg-status-active'
  return (
    <div>
      <p className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon className="size-4" aria-hidden /> {label}
        </span>
        <span className="font-medium tabular-nums">{pct(value)}</span>
      </p>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? undefined}
      >
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${Math.min(100, value ?? 0)}%` }} />
      </div>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  )
}

function Fact({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden /> {label}
      </dt>
      <dd className="mt-0.5 font-medium tabular-nums">
        {value}
        {hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{hint}</span>}
      </dd>
    </div>
  )
}
