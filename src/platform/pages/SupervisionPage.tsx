import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Bug,
  CheckCircle2,
  ChevronDown,
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
    cores?: number | null
  }>
}

/** Chiffres d'un outil, ou null s'il n'est pas relié ou pas lu. */
const lu = <T,>(b: Bloc<T>): T | null => (b.configured && !b.error ? (b as T) : null)

/** 1 000 000 s → « 11 j 13 h » ; en dessous d'un jour, « 3 h 05 ». */
function longDuration(seconds: number) {
  const days = Math.floor(seconds / 86400)
  return (days > 0 ? `${days} j ${Math.floor((seconds % 86400) / 3600)} h` : formatDuration(seconds)).replace(/ /g, ' ')
}

const pct = (v: number | null) => (v === null ? '—' : `${formatNumber(v)} %`)
const mo = (v: number | null) => (v === null ? '—' : v >= 1024 ? `${formatNumber(Math.round(v / 102.4) / 10)} Go` : `${formatNumber(v)} Mo`)

/** Ce que surveille chaque adresse, en clair. */
function monitorRole(url: string) {
  if (url.includes('/api/')) return 'Le moteur de PerformX : l’app mobile, le site et la console passent tous par lui.'
  if (url.includes('://app.')) return 'L’app des agents et chefs d’équipe en version web (iPhone, navigateur).'
  return 'Le site public et l’espace en ligne des structures clientes.'
}

/** Projets Sentry, en clair. */
function projectLabel(slug: string) {
  if (slug.endsWith('-api')) return 'Serveur (API)'
  if (slug.endsWith('-web')) return 'Site et console'
  if (slug.endsWith('-mobile')) return 'App mobile'
  return slug
}

/** Lecture de la charge par rapport au nombre de cœurs. */
function loadLevel(load: number, cores: number) {
  if (load < cores * 0.7) return { label: 'faible, le serveur est à l’aise', tone: 'text-status-active' }
  if (load < cores) return { label: 'élevée, à surveiller', tone: 'text-status-paused' }
  return { label: 'saturée, des tâches attendent leur tour', tone: 'text-status-alert' }
}

const GUIDE_KEY = 'px-supervision-guide'

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
            ? `La santé de PerformX en un coup d’œil · mis à jour ${formatRelative(d.generatedAt)}`
            : 'La santé de PerformX en un coup d’œil'
        }
        actions={
          <Button variant="outline" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />} Actualiser
          </Button>
        }
      />
      <Guide />
      <QueryState query={query} rows={6}>
        {d && <Content d={d} />}
      </QueryState>
    </Page>
  )
}

/** Mode d'emploi de la page, ouvert à la première visite puis replié au choix. */
function Guide() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(GUIDE_KEY) !== 'closed'
    } catch {
      return true
    }
  })
  const toggle = () => {
    setOpen(!open)
    try {
      localStorage.setItem(GUIDE_KEY, open ? 'closed' : 'open')
    } catch {
      // stockage indisponible : le choix vaut pour cette visite
    }
  }
  return (
    <section className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="supervision-guide"
        className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left hover:bg-muted/50"
      >
        <BookOpen className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="flex-1">
          <span className="block font-semibold">Comment lire cette page</span>
          <span className="block text-sm text-muted-foreground">
            Ce que veut dire chaque chiffre, et quoi faire si quelque chose ne va pas.
          </span>
        </span>
        <ChevronDown className={cn('size-5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div id="supervision-guide" className="grid gap-5 border-t px-4 py-4 text-sm leading-relaxed md:grid-cols-2">
          <GuideItem title="En résumé">
            Cette page rassemble au même endroit l’état de PerformX et ce que voient trois outils de surveillance externes. Le{' '}
            <strong>bandeau du haut</strong> suffit au quotidien : <span className="text-status-active">vert</span>, rien n’est cassé ;{' '}
            <span className="text-status-alert">rouge</span>, il liste ce qui ne va pas et quoi faire. La page se met à jour seule chaque
            minute ; « Actualiser » relit tout immédiatement.
          </GuideItem>
          <GuideItem title="Les quatre chiffres du haut">
            <strong>Plateforme</strong> : « En service » si le serveur, la base de données (où sont rangées toutes les informations) et
            Redis (la mémoire rapide qui fait vivre la carte en direct et les connexions) répondent. <strong>Agents en journée</strong> :
            agents qui ont démarré leur journée sans l’avoir terminée, toutes structures confondues. <strong>Positions reçues</strong> :
            points GPS arrivés des téléphones dans la dernière heure. <strong>Erreurs à traiter</strong> : bugs notés par PerformX lui-même.
          </GuideItem>
          <GuideItem title="Disponibilité (UptimeRobot)">
            Un service extérieur visite nos adresses toutes les 5 minutes, comme le ferait un client. Le pourcentage est la part du temps où
            l’adresse a répondu : <strong>99,9 % sur 30 jours</strong> correspond à environ 43 minutes de coupure dans le mois. En dessous
            de 99 %, le chiffre passe en rouge. Une réponse en moins d’une seconde (1 000 ms) est bonne. En cas de coupure, UptimeRobot
            envoie aussi un e-mail.
          </GuideItem>
          <GuideItem title="Serveur (Netdata)">
            La machine qui héberge PerformX. <strong>Processeur</strong> : l’effort de calcul. <strong>Mémoire</strong> : l’espace de
            travail des programmes. <strong>Disque</strong> : l’espace de stockage (base, photos, sauvegardes). Les jauges sont vertes sous
            75 %, orange jusqu’à 90 %, rouges au-delà. La <strong>charge</strong> compte les tâches en cours : tant qu’elle reste sous le
            nombre de cœurs du processeur, tout va bien.
          </GuideItem>
          <GuideItem title="Erreurs signalées (Sentry)">
            Quand un bug survient sur le serveur, le site ou l’app mobile, Sentry en garde le détail technique : combien de fois, pour
            combien de personnes, à quel endroit du code. « Non résolue » veut dire qu’elle n’a pas encore été marquée corrigée. Cliquez sur
            une erreur pour l’ouvrir dans Sentry et transmettez le lien au développeur ; une fois corrigée, cliquez sur « Resolve ». Si elle
            revient, Sentry la rouvre tout seul.
          </GuideItem>
          <GuideItem title="Journal interne ou Sentry ?">
            Le même bug apparaît souvent aux deux endroits. Le <strong>journal des erreurs</strong> de la console est un résumé simple, dans
            PerformX. <strong>Sentry</strong> contient le détail complet pour le développeur. Marquez l’erreur corrigée dans les deux une
            fois le correctif en ligne.
          </GuideItem>
        </div>
      )}
    </section>
  )
}

function GuideItem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 font-semibold">{title}</h3>
      <p className="text-muted-foreground">{children}</p>
    </div>
  )
}

/** Phrase d'introduction d'une carte. */
function Intro({ children, inset }: { children: ReactNode; inset?: boolean }) {
  return <p className={cn('text-sm text-muted-foreground', inset ? 'mb-4' : 'border-b px-4 py-3')}>{children}</p>
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
          <p className="text-sm">
            <span className="font-medium">Tout fonctionne normalement.</span>{' '}
            <span className="text-muted-foreground">Aucune panne : le site, l’app et le serveur répondent.</span>
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {alerts.map((a) => (
              <li key={a.text}>
                <span className="font-medium">{a.text}</span> <span className="text-muted-foreground">{a.advice}</span>
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
          hint={`Base de données ${p.health.database === 'up' ? 'OK' : 'en panne'} · Redis ${p.health.redis === 'up' ? 'OK' : 'en panne'} · redémarrée il y a ${longDuration(p.apiUptimeS)}`}
        />
        <Kpi
          icon={Users}
          label="Agents en journée"
          value={p.activeDays === null ? '—' : formatNumber(p.activeDays)}
          hint="Journée démarrée et pas encore terminée, toutes structures"
        />
        <Kpi
          icon={MapPin}
          label="Positions reçues"
          value={p.positionsLastHour === null ? '—' : formatNumber(p.positionsLastHour)}
          hint={
            p.activeDays && !p.positionsLastHour
              ? 'Aucune position alors que des agents sont en journée : à vérifier'
              : 'Points GPS reçus des téléphones dans la dernière heure'
          }
          tone={p.activeDays && !p.positionsLastHour ? 'text-status-paused' : undefined}
        />
        <Kpi
          icon={Bug}
          label="Erreurs à traiter"
          value={formatNumber(p.errorLog.open)}
          tone={p.errorLog.open ? 'text-status-alert' : undefined}
          hint={`Journal interne · ${p.errorLog.lastDay} survenue${p.errorLog.lastDay > 1 ? 's' : ''} ces dernières 24 h`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Disponibilité" actions={<Source name="UptimeRobot" />} flush>
          <Intro>
            Nos adresses vues de l’extérieur, comme un client, toutes les 5 minutes. Le pourcentage indique la part du temps où elles ont
            répondu.
          </Intro>
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
          <Intro inset>
            La machine qui héberge PerformX. Vert : à l’aise ; orange (dès 75 %) : à surveiller ; rouge (dès 90 %) : le serveur arrive à sa
            limite.
          </Intro>
          <Block bloc={d.server} tool="Netdata" setting="NETDATA_URL" inset>
            {(s) => (
              <div className="flex flex-col gap-4">
                <Gauge icon={Cpu} label="Processeur" value={s.cpu} detail="Effort de calcul, en moyenne sur la dernière minute" />
                <Gauge
                  icon={MemoryStick}
                  label="Mémoire"
                  value={s.ram?.usedPct ?? null}
                  detail={s.ram ? `Espace de travail des programmes · ${mo(s.ram.totalMb)} au total` : undefined}
                />
                <Gauge
                  icon={HardDrive}
                  label="Disque"
                  value={s.disk?.usedPct ?? null}
                  detail={
                    s.disk
                      ? `Stockage (base, photos, sauvegardes) · ${formatNumber(s.disk.availGb)} Go libres sur ${formatNumber(s.disk.totalGb)} Go`
                      : undefined
                  }
                />
                {s.load && <Load load={s.load} cores={s.cores ?? null} />}
                {s.uptimeS !== null && (
                  <p className="text-xs text-muted-foreground">Serveur allumé sans interruption depuis {longDuration(s.uptimeS)}.</p>
                )}
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
        <Intro inset>
          Les bugs du serveur, du site et de l’app mobile, avec leur détail technique. Cliquez sur une erreur pour l’ouvrir dans Sentry ;
          une fois corrigée, marquez-la « Resolve » là-bas.
        </Intro>
        <Block bloc={d.errors} tool="Sentry" setting="SENTRY_AUTH_TOKEN et SENTRY_ORG" inset>
          {(e) => (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div className="flex flex-col gap-3">
                <p className="text-sm">
                  <span className={cn('text-2xl font-semibold tabular-nums', e.unresolved > 0 && 'text-status-alert')}>
                    {formatNumber(e.unresolved)}
                  </span>{' '}
                  <span className="text-muted-foreground">
                    erreur{e.unresolved > 1 ? 's' : ''} non résolue{e.unresolved > 1 ? 's' : ''} (pas encore marquée
                    {e.unresolved > 1 ? 's' : ''} corrigée{e.unresolved > 1 ? 's' : ''})
                  </span>
                </p>
                <ul className="flex flex-wrap gap-1.5" aria-label="Erreurs non résolues par partie de PerformX">
                  {e.projects.map((pr) => (
                    <li key={pr.slug} className="rounded-full border px-2.5 py-0.5 text-xs">
                      {projectLabel(pr.slug)} · <span className="font-medium tabular-nums">{pr.unresolved}</span>
                    </li>
                  ))}
                </ul>
                <p className="-mb-1 text-xs text-muted-foreground">
                  Erreurs reçues par jour, 7 derniers jours (une même erreur peut compter plusieurs fois)
                </p>
                <Chart
                  data={e.perDay.map((x) => ({ label: `${x.date.slice(8, 10)}/${x.date.slice(5, 7)}`, count: x.count }))}
                  dataKey="count"
                  name="Erreurs reçues par jour, 7 derniers jours"
                  height={160}
                />
              </div>
              {e.top.length === 0 ? (
                <p className="self-center text-center text-sm text-muted-foreground">Aucune erreur en cours : rien à corriger.</p>
              ) : (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Les plus fréquentes</h3>
                  <ul className="flex flex-col divide-y">
                    {e.top.map((i) => (
                      <li key={i.link} className="py-2 first:pt-0">
                        <a href={i.link} target="_blank" rel="noreferrer" className="font-medium break-words hover:underline">
                          {i.title}
                        </a>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {projectLabel(i.project)} · <span className="tabular-nums">{formatNumber(i.count)}</span> fois
                          {i.users > 0 && ` · ${i.users} personne${i.users > 1 ? 's' : ''} touchée${i.users > 1 ? 's' : ''}`} · dernière{' '}
                          {formatRelative(i.lastSeen)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Block>
      </Card>

      <Card title="Ressources de PerformX">
        <Intro inset>
          Ce que PerformX occupe lui-même sur le serveur. Ces chiffres grandissent avec le nombre de structures et d’agents.
        </Intro>
        <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <Fact
            icon={Database}
            label="Base de données"
            value={mo(p.databaseMb)}
            hint="Toutes les informations enregistrées : structures, journées, positions, formulaires…"
          />
          <Fact
            icon={Database}
            label="Connexions à la base"
            value={p.databaseConnections === null ? '—' : formatNumber(p.databaseConnections)}
            hint="Accès ouverts en ce moment par l’API ; quelques dizaines au plus, c’est normal"
          />
          <Fact
            icon={MemoryStick}
            label="Mémoire Redis"
            value={mo(p.redisMemoryMb)}
            hint="Mémoire rapide : carte en direct, connexions, limites de requêtes"
          />
          <Fact
            icon={Server}
            label="Mémoire de l’API"
            value={mo(p.apiMemoryMb)}
            hint={`Le programme principal ; redémarré à chaque mise en ligne, il y a ${longDuration(p.apiUptimeS)}`}
          />
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Les erreurs notées par PerformX se traitent dans le{' '}
          <Link to={to('/errors')} className="underline">
            journal des erreurs
          </Link>
          .
        </p>
      </Card>
    </>
  )
}

/** Points à surveiller, affichés en tête de page, avec la conduite à tenir. */
function problems(d: Supervision) {
  const list: { text: string; advice: string }[] = []
  const h = d.performx.health
  const prevenir = 'Prévenez le développeur ou l’hébergeur.'
  if (h.database !== 'up') list.push({ text: 'La base de données ne répond pas.', advice: `Plus rien ne s’enregistre. ${prevenir}` })
  if (h.redis !== 'up')
    list.push({ text: 'Redis ne répond pas.', advice: `La carte en direct et les connexions sont touchées. ${prevenir}` })
  const a = lu(d.availability)
  if (a) {
    for (const m of a.monitors.filter((x) => x.status === 'down'))
      list.push({ text: `${m.name} est injoignable.`, advice: `Les utilisateurs ne peuvent pas y accéder. ${prevenir}` })
  }
  const s = lu(d.server)
  if (s) {
    if ((s.cpu ?? 0) >= 90)
      list.push({
        text: `Processeur du serveur chargé à ${pct(s.cpu)}.`,
        advice: 'PerformX peut ralentir. Si cela dure, prévoyez un serveur plus puissant.',
      })
    if ((s.ram?.usedPct ?? 0) >= 90)
      list.push({
        text: `Mémoire du serveur utilisée à ${pct(s.ram!.usedPct)}.`,
        advice: 'Risque de ralentissements ou d’arrêts. Si cela dure, ajoutez de la mémoire.',
      })
    if ((s.disk?.usedPct ?? 0) >= 85)
      list.push({
        text: `Disque du serveur rempli à ${pct(s.disk!.usedPct)}.`,
        advice: 'Disque plein, plus rien ne s’enregistre : libérez de la place ou agrandissez-le.',
      })
  }
  for (const [name, b] of [
    ['UptimeRobot', d.availability],
    ['Sentry', d.errors],
    ['Netdata', d.server],
  ] as const) {
    if (b.configured && b.error)
      list.push({ text: `${name} n’a pas pu être lu.`, advice: 'PerformX n’est pas forcément en panne ; le détail est dans sa carte.' })
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
        <p className="flex flex-wrap items-center gap-x-2 font-medium">
          <span className={cn('size-2 shrink-0 rounded-full', s.dot)} aria-hidden />
          <span className="break-all">{m.name}</span>
          <span className={cn('text-xs font-normal', s.text)}>{s.label}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{monitorRole(m.url)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {m.responseMs !== null && `Répond en ${formatNumber(m.responseMs)} ms${m.responseMs < 1000 ? ' (rapide)' : ' (lent)'} · `}
          {last ? `Dernière coupure le ${formatDateTime(last.at)}, pendant ${longDuration(last.durationS)}` : 'Aucune coupure récente'}
        </p>
      </div>
      <dl className="flex gap-4 text-right text-xs" aria-label="Part du temps en ligne">
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

/** Charge du serveur, lue par rapport au nombre de cœurs quand on le connaît. */
function Load({ load, cores }: { load: { one: number; five: number; fifteen: number }; cores: number | null }) {
  const level = cores ? loadLevel(load.one, cores) : null
  return (
    <div className="text-sm">
      <p className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Activity className="size-4" aria-hidden /> Charge
        </span>
        <span className="font-medium tabular-nums">
          {formatNumber(load.one)}
          {cores ? ` pour ${cores} cœurs` : ''}
        </span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Tâches en cours en même temps{level && <span className={level.tone}> : {level.label}</span>}. Moyenne sur 1, 5 et 15 min :{' '}
        {formatNumber(load.one)} · {formatNumber(load.five)} · {formatNumber(load.fifteen)}.
      </p>
    </div>
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
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  )
}
