import { AlertType, type AgentAlertInfo } from '@suivi/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CheckCircle2, Hand, Loader2, Map as MapIcon, Siren } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ALERT_META, alertDetail, useOpenAlerts } from '@/lib/alerts'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDateTime, formatRelative, formatTime, fullName } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { cn } from '@/lib/utils'

const ALL = 'all'

/** « depuis 12 min » / « 1 h 05 ». */
function duration(from: string, to: string | null, now: number) {
  const minutes = Math.max(1, Math.round(((to ? Date.parse(to) : now) - Date.parse(from)) / 60_000))
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

/**
 * Centre d'alertes des responsables : situations à surveiller sur le terrain, ouvertes et
 * refermées automatiquement, et prises en charge par un responsable.
 */
export function AlertsPage() {
  const { settings } = useMe()
  const [tab, setTab] = useState<'open' | 'resolved'>('open')
  const [type, setType] = useState<string>(ALL)
  const [acking, setAcking] = useState<AgentAlertInfo | null>(null)
  const [note, setNote] = useState('')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const open = useOpenAlerts()
  const history = useQuery({
    queryKey: ['alerts', 'resolved', type],
    enabled: tab === 'resolved',
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await api.get<AgentAlertInfo[]>('/alerts', {
          params: { status: 'resolved', type: type === ALL ? undefined : type, from: new Date(now - 7 * 86400_000).toISOString() },
        })
      ).data,
  })
  const query = tab === 'open' ? open : history
  const items = (query.data ?? []).filter((a) => type === ALL || a.type === type)

  const ack = useApiMutation(() => api.post(`/alerts/${acking!.id}/ack`, { note: note.trim() || undefined }), {
    success: 'Alerte prise en charge',
    invalidate: [['alerts']],
    onSuccess: () => {
      setAcking(null)
      setNote('')
    },
  })

  return (
    <Page>
      <PageHeader
        title="Alertes"
        description="Situations à surveiller sur le terrain. Elles se referment d’elles-mêmes quand la situation se règle."
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'open' | 'resolved')}>
          <TabsList>
            <TabsTrigger value="open">En cours{open.data ? ` (${open.data.length})` : ''}</TabsTrigger>
            <TabsTrigger value="resolved">Refermées (7 jours)</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex w-full flex-col gap-1.5 sm:w-60">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v ?? ALL)}>
            <SelectTrigger className="w-full" aria-label="Type d’alerte">
              <SelectValue>{(v: string) => (v === ALL ? 'Tous les types' : ALERT_META[v as AlertType].label)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les types</SelectItem>
              {Object.values(AlertType).map((t) => (
                <SelectItem key={t} value={t}>
                  {ALERT_META[t].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <QueryState query={query}>
        {items.length === 0 ? (
          <EmptyState
            icon={tab === 'open' ? CheckCircle2 : Siren}
            title={tab === 'open' ? 'Aucune alerte en cours' : 'Aucune alerte refermée'}
            description={tab === 'open' ? 'Tout va bien sur le terrain.' : 'Rien sur les 7 derniers jours pour ce filtre.'}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((a) => {
              const meta = ALERT_META[a.type]
              return (
                <li
                  key={a.id}
                  className={cn(
                    'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card p-3',
                    !a.resolvedAt && !a.acknowledgedAt && 'border-status-alert/30',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full',
                      a.resolvedAt ? 'bg-muted text-muted-foreground' : 'bg-status-alert/10 text-status-alert',
                    )}
                  >
                    <meta.icon className="size-4" aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="text-sm font-medium">
                      {fullName(a.agent)} · <span className={cn(!a.resolvedAt && 'text-status-alert')}>{meta.label}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {alertDetail(a, settings.timezone)} ·{' '}
                      {a.resolvedAt
                        ? `${formatDateTime(a.startedAt, settings.timezone)}, pendant ${duration(a.startedAt, a.resolvedAt, now)}`
                        : `depuis ${duration(a.startedAt, null, now)} (${formatRelative(a.startedAt, now)})`}
                    </p>
                    {a.acknowledgedAt && (
                      <p className="mt-1 text-xs">
                        <Hand className="mr-1 inline size-3.5 align-[-2px] text-primary" aria-hidden />
                        Pris en charge par {fullName(a.acknowledgedBy)} à {formatTime(a.acknowledgedAt, settings.timezone)}
                        {a.note && ` : « ${a.note} »`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {a.dayId && !a.resolvedAt && (
                      <Button size="sm" variant="ghost" nativeButton={false} render={<Link to={`/map?agent=${a.agent.id}`} />}>
                        <MapIcon aria-hidden /> Carte
                      </Button>
                    )}
                    {!a.resolvedAt && !a.acknowledgedAt && (
                      <Button size="sm" variant="outline" onClick={() => setAcking(a)}>
                        <Hand aria-hidden /> Je m’en occupe
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </QueryState>

      <Dialog open={!!acking} onOpenChange={(o) => !o && setAcking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prendre en charge</DialogTitle>
            <DialogDescription>
              {acking && `${ALERT_META[acking.type].label} · ${fullName(acking.agent)}.`} Les autres responsables verront que vous vous en
              occupez.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="ack-note">Ce que vous avez fait (facultatif)</FieldLabel>
            <Textarea
              id="ack-note"
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex. Appelé : en rendez-vous client"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcking(null)}>
              Annuler
            </Button>
            <Button disabled={ack.isPending} onClick={() => ack.mutate(undefined)}>
              {ack.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Je m’en occupe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}
