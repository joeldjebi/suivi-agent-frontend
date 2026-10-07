import { AlertType, Role, type DailyReport, type DailyReportAgent } from '@suivi/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clock,
  Loader2,
  Megaphone,
  MessageCircle,
  MoonStar,
  Phone,
} from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import { ExportButton } from '@/components/app/export-button'
import { Page, PageHeader, QueryState } from '@/components/app/page'
import { StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ALERT_META } from '@/lib/alerts'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDate, formatPhone, formatTime, formatWorkday, fullName } from '@/lib/format'
import { useApiMutation, useGroups } from '@/lib/queries'
import { cn } from '@/lib/utils'

const ALL = 'all'

function hours(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const m = minutes % 60
  return `${Math.floor(minutes / 60)} h${m ? ` ${String(m).padStart(2, '0')}` : ''}`
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const STATUS: Record<DailyReportAgent['status'], [string, 'ended' | 'active' | 'paused' | 'alert', typeof Clock]> = {
  not_started: ['Pas de journée', 'ended', CircleDashed],
  working: ['En cours', 'active', Clock],
  ended: ['Terminée', 'ended', CheckCircle2],
  auto: ['Non clôturée', 'paused', MoonStar],
}

/** Bilan d'une journée : l'équipe du chef, ou toute la structure pour l'administrateur. */
export function ReportPage() {
  const { settings, user } = useMe()
  const groups = useGroups()
  const [today] = useState(() => iso(new Date()))
  const [date, setDate] = useState(today)
  const [groupId, setGroupId] = useState(ALL)
  const [messaging, setMessaging] = useState(false)
  const query = useQuery({
    queryKey: ['reports', 'daily', date, groupId],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await api.get<DailyReport>('/reports/daily', { params: { date, groupId: groupId === ALL ? undefined : groupId } })).data,
    refetchInterval: date === today ? 60_000 : false,
  })
  const shift = (days: number) => {
    const d = new Date(`${date}T12:00:00`)
    d.setDate(d.getDate() + days)
    setDate(iso(d))
  }
  const r = query.data
  const absent = r?.agents.filter((a) => a.status === 'not_started') ?? []
  const worked = r?.agents.filter((a) => a.status !== 'not_started') ?? []

  return (
    <Page>
      <PageHeader
        title="Bilan du jour"
        description={
          settings.dailyReportTime
            ? `Envoyé aussi aux responsables chaque jour à ${settings.dailyReportTime}.`
            : 'Qui a travaillé, combien de temps, et ce qui demande votre attention.'
        }
        actions={
          <>
            <ExportButton
              path="/exports/days"
              params={{ from: date, to: date, groupId: groupId === ALL ? undefined : groupId }}
              description={`Journées du ${formatDate(date)}`}
            />
            <Button onClick={() => setMessaging(true)}>
              <Megaphone aria-hidden /> Message à l’équipe
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="flex items-end gap-1">
          <Button variant="outline" size="icon" aria-label="Jour précédent" onClick={() => shift(-1)}>
            <ChevronLeft aria-hidden />
          </Button>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-date">Jour</Label>
            <Input id="report-date" type="date" max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </div>
          <Button variant="outline" size="icon" aria-label="Jour suivant" disabled={date >= today} onClick={() => shift(1)}>
            <ChevronRight aria-hidden />
          </Button>
        </div>
        {user.role === Role.Admin && (groups.data?.length ?? 0) > 0 && (
          <div className="flex w-56 flex-col gap-1.5">
            <Label>Groupe</Label>
            <Select value={groupId} onValueChange={(v) => setGroupId(v ?? ALL)}>
              <SelectTrigger className="w-full" aria-label="Groupe">
                <SelectValue>{(v: string) => (v === ALL ? 'Toute la structure' : groups.data?.find((g) => g.id === v)?.name)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toute la structure</SelectItem>
                {groups.data?.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <QueryState query={query}>
        {r && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Résumé">
              {(
                [
                  [
                    `${r.summary.worked} / ${r.summary.agents}`,
                    date === today ? 'agents en journée ou partis' : 'agents ont travaillé',
                    null,
                  ],
                  [hours(r.summary.workedMinutes), 'temps travaillé', null],
                  [
                    String(r.summary.formsAccepted),
                    r.summary.formsRejected ? `formulaires · ${r.summary.formsRejected} rejeté(s)` : 'formulaires',
                    null,
                  ],
                  [String(r.summary.alerts), 'alertes', r.summary.alerts ? 'text-status-alert' : null],
                  [String(r.summary.zoneExits), 'sorties de zone', r.summary.zoneExits ? 'text-status-paused' : null],
                ] as const
              ).map(([value, label, tone]) => (
                <div key={label} className="flex flex-col rounded-lg border bg-card p-4">
                  <span className={cn('text-2xl font-semibold tabular-nums', tone)}>{value}</span>
                  <span className="text-sm text-muted-foreground">{label}</span>
                </div>
              ))}
            </section>
            {(r.summary.late > 0 || r.summary.autoClosed > 0 || absent.length > 0) && (
              <p className="text-sm text-muted-foreground">
                {[
                  absent.length && `${absent.length} ${date === today ? 'pas encore démarré(s)' : 'absent(s)'}`,
                  r.summary.late && `${r.summary.late} en retard`,
                  r.summary.autoClosed && `${r.summary.autoClosed} journée(s) non clôturée(s)`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Horaires</TableHead>
                    <TableHead className="text-right">Travaillé</TableHead>
                    <TableHead className="text-right">Formulaires</TableHead>
                    <TableHead>À noter</TableHead>
                    <TableHead className="sr-only">Contacter</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...absent, ...worked].map((a) => {
                    const [label, tone, icon] = STATUS[a.status]
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">
                          {fullName(a)}
                          {a.group && <span className="block text-xs font-normal text-muted-foreground">{a.group}</span>}
                        </TableCell>
                        <TableCell>
                          <StatusPill tone={tone} icon={icon} label={label} />
                        </TableCell>
                        <TableCell>{a.zone ?? '—'}</TableCell>
                        <TableCell className="tabular-nums">
                          {a.startedAt
                            ? `${formatTime(a.startedAt, settings.timezone)} → ${a.endedAt ? formatTime(a.endedAt, settings.timezone) : 'en cours'}`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.startedAt ? hours(a.workedMinutes) : '—'}
                          {a.startedAt && a.targetMinutes ? (
                            <span className="block text-xs text-muted-foreground">
                              {Math.round((a.workedMinutes / a.targetMinutes) * 100)} % de {formatWorkday(a.targetMinutes)}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.formsAccepted}
                          {a.formsRejected > 0 && <span className="text-xs text-muted-foreground"> (+{a.formsRejected} rejeté)</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 text-xs">
                            {a.late && <span className="rounded-full bg-status-paused/10 px-2 text-status-paused">En retard</span>}
                            {a.zoneExits > 0 && (
                              <span className="rounded-full bg-status-paused/10 px-2 text-status-paused">
                                {a.zoneExits} sortie(s) · {a.outsideMinutes} min
                              </span>
                            )}
                            {a.alerts
                              .filter((t) => t !== AlertType.LateStart)
                              .map((t) => (
                                <span key={t} className="rounded-full bg-status-alert/10 px-2 text-status-alert">
                                  {ALERT_META[t as AlertType]?.label ?? t}
                                </span>
                              ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {a.phone && (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Appeler ${fullName(a)} (${formatPhone(a.phone)})`}
                                nativeButton={false}
                                render={<a href={`tel:${a.phone}`} />}
                              >
                                <Phone aria-hidden />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`WhatsApp ${fullName(a)}`}
                                nativeButton={false}
                                render={
                                  <a href={`https://wa.me/${a.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer noopener" />
                                }
                              >
                                <MessageCircle className="text-[#25D366]" aria-hidden />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </QueryState>
      <MessageDialog open={messaging} onOpenChange={setMessaging} agents={r?.agents ?? []} />
    </Page>
  )
}

function MessageDialog({ open, onOpenChange, agents }: { open: boolean; onOpenChange: (o: boolean) => void; agents: DailyReportAgent[] }) {
  const [body, setBody] = useState('')
  const [everyone, setEveryone] = useState(true)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const send = useApiMutation(
    () => api.post<{ recipients: number }>('/team-messages', { body: body.trim(), agentIds: everyone ? undefined : [...chosen] }),
    {
      invalidate: [['team-messages']],
      onSuccess: (res) => {
        toast.success(`Message envoyé à ${res.data.recipients} agent${res.data.recipients > 1 ? 's' : ''}`)
        setBody('')
        onOpenChange(false)
      },
    },
  )
  const ready = body.trim().length >= 2 && (everyone || chosen.size > 0)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Message à l’équipe</DialogTitle>
          <DialogDescription>Chaque agent le reçoit en notification dans l’application.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="team-message">Message</FieldLabel>
          <Textarea
            id="team-message"
            rows={4}
            maxLength={500}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ex. Réunion à 17 h au bureau du Plateau."
          />
        </Field>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={everyone} onCheckedChange={(v) => setEveryone(!!v)} /> Toute l’équipe ({agents.length} agents)
          </label>
          {!everyone && (
            <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
              {agents.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={chosen.has(a.id)}
                    onCheckedChange={(on) => {
                      const next = new Set(chosen)
                      if (on) next.add(a.id)
                      else next.delete(a.id)
                      setChosen(next)
                    }}
                  />
                  {fullName(a)}
                </label>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={!ready || send.isPending} onClick={() => send.mutate(undefined)}>
            {send.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
