import { Role } from '@suivi/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  BellRing,
  Check,
  Loader2,
  MapPinned,
  Search,
  Send,
  Smartphone,
  Target,
  UserCog,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { api, errorCode, errorMessage } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDateTime, fullName } from '@/lib/format'
import { roleLabel } from '@/lib/labels'
import { useAllUsers, useApiMutation, useZones } from '@/lib/queries'
import type { Mission, Page as PageOf } from '@/lib/types'
import { cn } from '@/lib/utils'

type Target = 'all' | 'agents' | 'leads' | 'users' | 'zones' | 'missions'

interface Audience {
  target: Target
  userIds?: string[]
  zoneIds?: string[]
  missionIds?: string[]
  includeLeads?: boolean
}

interface Preview {
  total: number
  agents: number
  leads: number
  reachable: number
  sample: string[]
}

interface Broadcast {
  id: string
  title: string
  body: string
  audience: Audience
  recipients: number
  reachable: number
  createdAt: string
  authorName: string | null
}

const TITLE_MAX = 65
const BODY_MAX = 500

const TARGETS: { value: Target; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'all', label: 'Tout le monde', hint: 'Agents et chefs d’équipe', icon: BellRing },
  { value: 'agents', label: 'Les agents', hint: 'Tous les agents actifs', icon: Users },
  { value: 'leads', label: 'Les chefs d’équipe', hint: 'Tous les chefs actifs', icon: UserCog },
  { value: 'users', label: 'Personnes choisies', hint: 'Un ou plusieurs agents ou chefs', icon: UsersRound },
  { value: 'zones', label: 'Par zone', hint: 'Les agents de ces zones', icon: MapPinned },
  { value: 'missions', label: 'Par mission', hint: 'Les agents de ces missions', icon: Target },
]

const targetLabel = Object.fromEntries(TARGETS.map((t) => [t.value, t.label])) as Record<Target, string>

/** Résumé d'une audience pour l'historique. */
function audienceSummary(a: Audience): string {
  const n = (ids: string[] | undefined, one: string, many: string) => {
    const c = ids?.length ?? 0
    return `${c} ${c > 1 ? many : one}`
  }
  const leads = a.includeLeads ? ', chefs compris' : ''
  switch (a.target) {
    case 'users':
      return n(a.userIds, 'personne choisie', 'personnes choisies')
    case 'zones':
      return `${n(a.zoneIds, 'zone', 'zones')}${leads}`
    case 'missions':
      return `${n(a.missionIds, 'mission', 'missions')}${leads}`
    default:
      return targetLabel[a.target] ?? a.target
  }
}

/** Délai avant de recalculer l'aperçu pendant la sélection. */
function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

/**
 * Notifications de l'administrateur à ses équipes : sur le téléphone (notification push) et
 * dans la liste des notifications de l'app.
 */
export function BroadcastsPage() {
  const [target, setTarget] = useState<Target>('all')
  const [userIds, setUserIds] = useState<string[]>([])
  const [zoneIds, setZoneIds] = useState<string[]>([])
  const [missionIds, setMissionIds] = useState<string[]>([])
  const [includeLeads, setIncludeLeads] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [tried, setTried] = useState(false)
  const { tenant } = useMe()

  const audience = useMemo<Audience>(
    () => ({
      target,
      ...(target === 'users' ? { userIds } : {}),
      ...(target === 'zones' ? { zoneIds, includeLeads } : {}),
      ...(target === 'missions' ? { missionIds, includeLeads } : {}),
    }),
    [target, userIds, zoneIds, missionIds, includeLeads],
  )
  const debouncedAudience = useDebounced(audience)

  const preview = useQuery({
    queryKey: ['broadcasts', 'preview', debouncedAudience],
    queryFn: async () => (await api.post<Preview>('/broadcasts/preview', { audience: debouncedAudience })).data,
    placeholderData: keepPreviousData,
    retry: false,
  })
  const emptySelection = errorCode(preview.error) === 'EMPTY_SELECTION'
  const count = preview.isError ? 0 : (preview.data?.total ?? 0)

  const history = useQuery({
    queryKey: ['broadcasts', 'history'],
    queryFn: async () => (await api.get<Broadcast[]>('/broadcasts')).data,
  })

  const send = useApiMutation(
    () => api.post<{ recipients: number; reachable: number }>('/broadcasts', { title: title.trim(), body: body.trim(), audience }),
    {
      invalidate: [['broadcasts']],
      onSuccess: () => {
        setConfirming(false)
        setTitle('')
        setBody('')
        setTried(false)
      },
      success: 'Notification envoyée',
    },
  )

  const titleError = tried && title.trim().length < 2 ? 'Titre requis' : null
  const bodyError = tried && body.trim().length < 2 ? 'Message requis' : null
  const ready = title.trim().length >= 2 && body.trim().length >= 2 && count > 0 && !preview.isFetching

  return (
    <Page>
      <PageHeader
        title="Notifications aux équipes"
        description="Prévenez vos agents et chefs d’équipe sur leur téléphone, même application fermée."
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Nouvelle notification</CardTitle>
            <CardDescription>Choisissez les destinataires, puis rédigez un message court et clair.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-3 text-sm font-medium">Destinataires</legend>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Destinataires">
                {TARGETS.map((t) => {
                  const on = target === t.value
                  return (
                    <button
                      key={t.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setTarget(t.value)}
                      className={cn(
                        'flex min-h-14 items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        on ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                      )}
                    >
                      <t.icon className={cn('mt-0.5 size-4 shrink-0', on ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{t.label}</span>
                        <span className="block text-xs text-muted-foreground">{t.hint}</span>
                      </span>
                    </button>
                  )
                })}
              </div>

              {target === 'users' && <PeoplePicker value={userIds} onChange={setUserIds} />}
              {target === 'zones' && <ZonesPicker value={zoneIds} onChange={setZoneIds} />}
              {target === 'missions' && <MissionsPicker value={missionIds} onChange={setMissionIds} />}
              {(target === 'zones' || target === 'missions') && (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="broadcast-leads">Inclure les chefs d’équipe</FieldLabel>
                    <FieldDescription>Les chefs des groupes concernés reçoivent aussi la notification.</FieldDescription>
                  </FieldContent>
                  <Switch id="broadcast-leads" checked={includeLeads} onCheckedChange={setIncludeLeads} />
                </Field>
              )}
              {target === 'zones' && (
                <p className="text-xs text-muted-foreground">
                  Agents des groupes rattachés à ces zones, et agents qui y ont travaillé ces 30 derniers jours.
                </p>
              )}
              {target === 'missions' && (
                <p className="text-xs text-muted-foreground">
                  Agent ou groupe assigné ; pour une mission ouverte, les agents de ses zones.
                </p>
              )}
            </fieldset>

            <div className="flex flex-col gap-4">
              <Field data-invalid={!!titleError}>
                <div className="flex items-baseline justify-between gap-2">
                  <FieldLabel htmlFor="broadcast-title">Titre</FieldLabel>
                  <Counter value={title.length} max={TITLE_MAX} />
                </div>
                <Input
                  id="broadcast-title"
                  value={title}
                  maxLength={TITLE_MAX}
                  placeholder="Ex. Réunion d’équipe demain"
                  aria-invalid={!!titleError}
                  onChange={(e) => setTitle(e.target.value)}
                />
                {titleError && <p className="text-sm text-destructive">{titleError}</p>}
              </Field>
              <Field data-invalid={!!bodyError}>
                <div className="flex items-baseline justify-between gap-2">
                  <FieldLabel htmlFor="broadcast-body">Message</FieldLabel>
                  <Counter value={body.length} max={BODY_MAX} />
                </div>
                <Textarea
                  id="broadcast-body"
                  value={body}
                  rows={4}
                  maxLength={BODY_MAX}
                  placeholder="Ex. Rendez-vous à 8 h au siège avec vos tenues."
                  aria-invalid={!!bodyError}
                  onChange={(e) => setBody(e.target.value)}
                />
                {bodyError ? (
                  <p className="text-sm text-destructive">{bodyError}</p>
                ) : (
                  <FieldDescription>Le téléphone affiche les premières lignes ; le message complet est dans l’app.</FieldDescription>
                )}
              </Field>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {emptySelection
                  ? 'Sélectionnez au moins un élément.'
                  : preview.isError
                    ? errorMessage(preview.error)
                    : count === 0 && preview.isSuccess
                      ? 'Personne ne correspond à ces destinataires.'
                      : `${count} destinataire${count > 1 ? 's' : ''}`}
              </p>
              <Button
                onClick={() => {
                  setTried(true)
                  if (ready) setConfirming(true)
                }}
                disabled={count === 0}
              >
                <Send aria-hidden /> Envoyer
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 lg:sticky lg:top-4">
          <PhonePreview structure={tenant.name} title={title} body={body} />
          <ReachCard preview={preview.isError ? undefined : preview.data} loading={preview.isFetching} />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Envois précédents</h2>
        <QueryState query={history}>
          {history.data?.length === 0 ? (
            <EmptyState icon={BellRing} title="Aucune notification envoyée" description="Vos envois apparaîtront ici." />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Notification</TableHead>
                    <TableHead>Destinataires</TableHead>
                    <TableHead className="text-right">Personnes</TableHead>
                    <TableHead>Envoyée par</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.data?.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="align-top text-sm whitespace-nowrap">{formatDateTime(b.createdAt)}</TableCell>
                      <TableCell className="max-w-md align-top">
                        <div className="font-medium">{b.title}</div>
                        <div className="line-clamp-2 text-sm whitespace-normal text-muted-foreground">{b.body}</div>
                      </TableCell>
                      <TableCell className="align-top text-sm">{audienceSummary(b.audience)}</TableCell>
                      <TableCell className="text-right align-top tabular-nums">
                        <div className="font-medium">{b.recipients}</div>
                        <div className="text-xs whitespace-nowrap text-muted-foreground">{b.reachable} sur téléphone</div>
                      </TableCell>
                      <TableCell className="align-top text-sm text-muted-foreground">{b.authorName ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </QueryState>
      </section>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Envoyer à {count} personne{count > 1 ? 's' : ''} ?
            </DialogTitle>
            <DialogDescription>{audienceSummary(audience)}. La notification ne pourra pas être retirée une fois envoyée.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="font-medium">{title.trim()}</div>
            <div className="mt-1 whitespace-pre-line text-muted-foreground">{body.trim()}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Annuler
            </Button>
            <Button onClick={() => send.mutate(undefined)} disabled={send.isPending}>
              {send.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className={cn('text-xs tabular-nums', value >= max ? 'text-status-alert' : 'text-muted-foreground')}>
      {value} / {max}
    </span>
  )
}

/** Aperçu de la notification telle qu'elle s'affiche sur un téléphone verrouillé. */
function PhonePreview({ structure, title, body }: { structure: string; title: string; body: string }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 px-4 pt-6 pb-8 text-white">
        <p className="text-center text-xs text-white/60">Aperçu sur le téléphone</p>
        <p className="mt-1 text-center text-4xl font-light tabular-nums">09:41</p>
        <div className="mt-5 rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-[11px] text-white/70">
            <span className="flex size-5 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Smartphone className="size-3" aria-hidden />
            </span>
            <span className="flex-1 truncate uppercase">{structure}</span>
            <span>maintenant</span>
          </div>
          <p className={cn('mt-2 truncate text-sm font-semibold', !title && 'text-white/50')}>{title || 'Titre de la notification'}</p>
          <p className={cn('line-clamp-3 text-sm', body ? 'text-white/90' : 'text-white/50')}>{body || 'Votre message apparaîtra ici.'}</p>
        </div>
      </div>
    </Card>
  )
}

function ReachCard({ preview, loading }: { preview: Preview | undefined; loading: boolean }) {
  const share = preview?.total ? Math.round((preview.reachable / preview.total) * 100) : 0
  return (
    <Card className={cn(loading && 'opacity-70')}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Destinataires {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">{preview?.total ?? 0}</span>
          <span className="text-sm text-muted-foreground">
            {preview
              ? `${preview.agents} agent${preview.agents > 1 ? 's' : ''} · ${preview.leads} chef${preview.leads > 1 ? 's' : ''}`
              : ''}
          </span>
        </div>
        {preview && preview.total > 0 && (
          <>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <span>Notifications activées</span>
                <span className="font-medium tabular-nums">
                  {preview.reachable} / {preview.total}
                </span>
              </div>
              <Progress value={share} aria-label="Part des destinataires joignables sur leur téléphone" />
              <p className="text-xs text-muted-foreground">
                {preview.reachable < preview.total
                  ? 'Les autres la verront dans la liste des notifications de l’app.'
                  : 'Tous la recevront sur leur téléphone.'}
              </p>
            </div>
            <ul className="flex flex-col gap-1 text-sm">
              {preview.sample.map((name) => (
                <li key={name} className="flex items-center gap-2 truncate">
                  <Check className="size-3.5 shrink-0 text-status-active" aria-hidden /> {name}
                </li>
              ))}
              {preview.total > preview.sample.length && (
                <li className="text-xs text-muted-foreground">et {preview.total - preview.sample.length} autre(s)</li>
              )}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

interface Option {
  id: string
  label: string
  hint?: string
}

/** Liste à cocher avec recherche. */
function Checklist({
  options,
  value,
  onChange,
  placeholder,
  empty,
  loading,
}: {
  options: Option[]
  value: string[]
  onChange: (ids: string[]) => void
  placeholder: string
  empty: string
  loading?: boolean
}) {
  const [search, setSearch] = useState('')
  const q = search.trim().toLocaleLowerCase('fr')
  const shown = q ? options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLocaleLowerCase('fr').includes(q)) : options
  const allShown = shown.length > 0 && shown.every((o) => value.includes(o.id))
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground tabular-nums">{value.length} sélectionné(s)</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!shown.length}
            onClick={() =>
              onChange(
                allShown ? value.filter((id) => !shown.some((o) => o.id === id)) : [...new Set([...value, ...shown.map((o) => o.id)])],
              )
            }
          >
            {allShown ? 'Tout retirer' : 'Tout cocher'}
          </Button>
        </div>
      </div>
      <div className="grid max-h-64 gap-0.5 overflow-y-auto sm:grid-cols-2">
        {loading ? (
          <p className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
          </p>
        ) : shown.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">{q ? 'Aucun résultat.' : empty}</p>
        ) : (
          shown.map((o) => {
            const checked = value.includes(o.id)
            return (
              <label key={o.id} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted">
                <Checkbox checked={checked} onCheckedChange={(on) => onChange(on ? [...value, o.id] : value.filter((id) => id !== o.id))} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{o.label}</span>
                  {o.hint && <span className="block truncate text-xs text-muted-foreground">{o.hint}</span>}
                </span>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}

function PeoplePicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const users = useAllUsers()
  const options = (users.data ?? [])
    .filter((u) => u.isActive && u.role !== Role.Admin)
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr'))
    .map((u) => ({ id: u.id, label: fullName(u), hint: roleLabel[u.role] }))
  return (
    <Checklist
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Rechercher un agent ou un chef"
      empty="Aucun agent ni chef actif."
      loading={users.isPending}
    />
  )
}

function ZonesPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const zones = useZones()
  const options = (zones.data ?? []).map((z) => ({ id: z.id, label: z.name }))
  return (
    <Checklist
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Rechercher une zone"
      empty="Aucune zone active."
      loading={zones.isPending}
    />
  )
}

function MissionsPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const missions = useQuery({
    queryKey: ['missions', 'broadcast-options'],
    queryFn: async () => (await api.get<PageOf<Mission>>('/missions', { params: { limit: 200 } })).data.items,
  })
  const options = (missions.data ?? []).map((m) => ({
    id: m.id,
    label: m.title,
    hint: m.assigneeAgentId ? 'Assignée à un agent' : m.assigneeGroupId ? 'Assignée à un groupe' : 'Ouverte',
  }))
  return (
    <Checklist
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Rechercher une mission"
      empty="Aucune mission en cours."
      loading={missions.isPending}
    />
  )
}
