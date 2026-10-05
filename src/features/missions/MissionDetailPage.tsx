import { FieldType, MissionStatus, ProgressMethod, SubmissionStatus } from '@suivi/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArchiveRestore, ArrowLeft, Ban, CalendarClock, Check, CircleSlash, FileText, Loader2, Pencil, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { IMPACT_LABELS, RemoveDialog } from '@/components/app/remove-dialog'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { SearchInput } from '@/components/app/search-input'
import { MissionStatusPill, StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDate, formatDateTime, formatNumber, fullName } from '@/lib/format'
import { progressMethodLabel } from '@/lib/labels'
import { usePaged } from '@/lib/pagination'
import { useAgents, useApiMutation, useGroups } from '@/lib/queries'
import type { MissionDetail, Submission } from '@/lib/types'
import { MissionEditDialog } from './MissionEditDialog'
import { MissionPayCard } from './MissionPayCard'
import { ExportButton } from '@/components/app/export-button'
import type { MissionField } from '@suivi/shared'

function displayValue(field: MissionField, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (field.type === FieldType.Boolean) return value ? 'Oui' : 'Non'
  if (field.type === FieldType.Number) return formatNumber(Number(value))
  if (field.type === FieldType.Date) return formatDate(String(value))
  return String(value)
}

const ALL = 'all'

export function MissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { settings } = useMe()
  const agents = useAgents()
  const groups = useGroups()
  const [rejecting, setRejecting] = useState<Submission | null>(null)
  const [reason, setReason] = useState('')
  const [removing, setRemoving] = useState(false)
  const [editing, setEditing] = useState(false)
  // Filtres des formulaires reçus (agent, statut, période côté serveur ; texte côté navigateur).
  const [agentFilter, setAgentFilter] = useState(ALL)
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [text, setText] = useState('')

  const mission = useQuery({
    queryKey: ['missions', id],
    queryFn: async () => (await api.get<MissionDetail>(`/missions/${id}`)).data,
  })
  const submissions = useQuery({
    queryKey: ['missions', id, 'submissions', { agentFilter, statusFilter, from, to }],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await api.get<Submission[]>(`/missions/${id}/submissions`, {
          params: {
            agentId: agentFilter === ALL ? undefined : agentFilter,
            status: statusFilter === ALL ? undefined : statusFilter,
            from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
            to: to ? new Date(new Date(`${to}T00:00:00`).getTime() + 86400_000).toISOString() : undefined,
          },
        })
      ).data,
  })
  const needle = text.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      (submissions.data ?? []).filter(
        (s) => !needle || `${fullName(s.agent)} ${Object.values(s.data).join(' ')}`.toLowerCase().includes(needle),
      ),
    [submissions.data, needle],
  )
  const paged = usePaged(filtered, 20)
  const filtersActive = agentFilter !== ALL || statusFilter !== ALL || from !== '' || to !== '' || needle !== ''
  const resetFilters = () => {
    setAgentFilter(ALL)
    setStatusFilter(ALL)
    setFrom('')
    setTo('')
    setText('')
  }

  const reject = useApiMutation(() => api.post(`/submissions/${rejecting!.id}/reject`, { reason: reason.trim() }), {
    success: 'Formulaire rejeté, l’agent a été notifié',
    invalidate: [['missions']],
    onSuccess: () => {
      setRejecting(null)
      setReason('')
    },
  })
  const setResult = useApiMutation((achieved: boolean) => api.post(`/missions/${id}/result`, { achieved }), {
    success: 'Résultat enregistré',
    invalidate: [['missions']],
  })
  const reactivate = useApiMutation(() => api.patch(`/missions/${id}`, { isActive: true }), {
    success: 'Mission réactivée',
    invalidate: [['missions']],
  })

  const m = mission.data
  const assignee = m?.assigneeAgentId
    ? fullName(agents.data?.find((a) => a.id === m.assigneeAgentId))
    : groups.data?.find((g) => g.id === m?.assigneeGroupId)?.name

  return (
    <Page>
      <Link to="/missions" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Missions
      </Link>
      <QueryState query={mission}>
        {m && (
          <>
            <PageHeader
              title={m.title}
              description={`${m.type.name} · ${m.assigneeAgentId ? 'Agent' : 'Groupe'} : ${assignee ?? '—'}`}
              actions={
                m.isActive ? (
                  <>
                    <Button variant="outline" onClick={() => setRemoving(true)}>
                      <Trash2 aria-hidden /> Désactiver ou supprimer
                    </Button>
                    <Button onClick={() => setEditing(true)}>
                      <Pencil aria-hidden /> Modifier
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setRemoving(true)}>
                      <Trash2 aria-hidden /> Supprimer
                    </Button>
                    <Button disabled={reactivate.isPending} onClick={() => reactivate.mutate(undefined)}>
                      <ArchiveRestore aria-hidden /> Réactiver
                    </Button>
                  </>
                )
              }
            />
            {!m.isActive && (
              <p
                role="status"
                className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/50 p-3 text-sm text-muted-foreground"
              >
                <CircleSlash className="size-4" aria-hidden />
                Mission désactivée : elle n'est plus visible des agents et n'accepte plus de formulaires.
              </p>
            )}
            <div className="grid gap-3 lg:grid-cols-3">
              <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 lg:col-span-2" aria-label="Progression">
                <div className="flex items-center justify-between gap-2">
                  <MissionStatusPill status={m.status} />
                  {m.dueDate && (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <CalendarClock className="size-4" aria-hidden /> Échéance : {formatDate(m.dueDate)}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums">{formatNumber(m.progress.current)}</span>
                  <span className="text-muted-foreground tabular-nums">/ {formatNumber(m.progress.target)}</span>
                  <span className="ml-auto text-lg font-medium tabular-nums">{m.progress.percent} %</span>
                </div>
                <Progress value={m.progress.percent} aria-label={`Progression : ${m.progress.percent} %`} />
                <p className="text-sm text-muted-foreground">
                  {progressMethodLabel[m.progressMethod]}
                  {m.progressMethod === ProgressMethod.FieldSum &&
                    ` : ${m.type.fields.find((f) => f.key === m.sumFieldKey)?.label ?? m.sumFieldKey}`}
                </p>
                {m.description && <p className="rounded-md bg-muted p-3 text-sm">{m.description}</p>}
                {m.progressMethod === ProgressMethod.Manual && (
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={setResult.isPending || m.status === MissionStatus.Achieved} onClick={() => setResult.mutate(true)}>
                      <Check aria-hidden /> Objectif atteint
                    </Button>
                    <Button
                      variant="outline"
                      disabled={setResult.isPending || m.status === MissionStatus.Failed}
                      onClick={() => setResult.mutate(false)}
                    >
                      <X aria-hidden /> Objectif non atteint
                    </Button>
                  </div>
                )}
              </section>
              <div className="flex flex-col gap-3">
                <section className="flex flex-col gap-2 rounded-lg border bg-card p-4" aria-label="Contributions">
                  <h2 className="text-sm font-semibold">Contributions</h2>
                  {m.contributions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {m.assigneeGroupId ? 'Aucune contribution pour le moment.' : 'Mission individuelle.'}
                    </p>
                  ) : (
                    <ol className="flex flex-col gap-2">
                      {m.contributions.map((c) => (
                        <li key={c.agentId} className="flex flex-col gap-1">
                          <div className="flex justify-between text-sm">
                            <span>{fullName(c)}</span>
                            <span className="font-medium tabular-nums">{formatNumber(c.value)}</span>
                          </div>
                          <Progress
                            value={Math.min(100, (c.value / m.progress.target) * 100)}
                            className="h-1.5"
                            aria-label={`Contribution de ${fullName(c)}`}
                          />
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
                <MissionPayCard mission={m} />
              </div>
            </div>

            <section className="flex flex-col gap-2" aria-label="Formulaires reçus">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">
                  Formulaires reçus
                  {submissions.data && <span className="ml-2 text-sm font-normal text-muted-foreground">{filtered.length}</span>}
                </h2>
                <div className="flex items-center gap-2">
                  {filtersActive && (
                    <Button variant="ghost" size="sm" onClick={resetFilters}>
                      <X aria-hidden /> Effacer les filtres
                    </Button>
                  )}
                  <ExportButton
                    path="/exports/submissions"
                    params={{
                      missionId: m.id,
                      agentId: agentFilter === ALL ? undefined : agentFilter,
                      status: statusFilter === ALL ? undefined : statusFilter,
                      from: from || undefined,
                      to: to || undefined,
                    }}
                    description={
                      agentFilter !== ALL || statusFilter !== ALL || from || to
                        ? 'Formulaires de la mission, avec les filtres agent, statut et période'
                        : 'Tous les formulaires de la mission, une colonne par champ'
                    }
                  />
                </div>
              </div>
              <div className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="flex flex-col gap-1.5">
                  <Label>Recherche</Label>
                  <SearchInput value={text} onChange={setText} placeholder="Agent ou réponse" label="Rechercher dans les formulaires" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Agent</Label>
                  <Select value={agentFilter} onValueChange={(v) => setAgentFilter(v ?? ALL)}>
                    <SelectTrigger className="w-full" aria-label="Agent">
                      <SelectValue>
                        {(v: string) => (v === ALL ? 'Tous les agents' : fullName(agents.data?.find((a) => a.id === v)))}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Tous les agents</SelectItem>
                      {(m.contributions.length
                        ? m.contributions.map((c) => ({ id: c.agentId, name: fullName(c) }))
                        : (agents.data ?? []).map((a) => ({ id: a.id, name: fullName(a) }))
                      ).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Statut</Label>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? ALL)}>
                    <SelectTrigger className="w-full" aria-label="Statut">
                      <SelectValue>{(v: string) => ({ [ALL]: 'Tous', accepted: 'Acceptés', rejected: 'Rejetés' })[v]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Tous</SelectItem>
                      <SelectItem value={SubmissionStatus.Accepted}>Acceptés</SelectItem>
                      <SelectItem value={SubmissionStatus.Rejected}>Rejetés</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sub-from">Du</Label>
                  <Input id="sub-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sub-to">Au</Label>
                  <Input id="sub-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
              <QueryState query={submissions}>
                {!filtered.length ? (
                  <EmptyState
                    icon={FileText}
                    title="Aucun formulaire"
                    description={
                      filtersActive
                        ? 'Aucun formulaire ne correspond à ces filtres.'
                        : "Les formulaires saisis dans l'app mobile apparaîtront ici."
                    }
                  />
                ) : (
                  <div className="overflow-x-auto rounded-lg border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Agent</TableHead>
                          <TableHead>Saisi le</TableHead>
                          {m.type.fields.map((f) => (
                            <TableHead key={f.key}>{f.label}</TableHead>
                          ))}
                          <TableHead>Statut</TableHead>
                          <TableHead>
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paged.items.map((s) => (
                          <TableRow key={s.id} className={s.status === SubmissionStatus.Rejected ? 'text-muted-foreground' : undefined}>
                            <TableCell className="font-medium">{fullName(s.agent)}</TableCell>
                            <TableCell className="tabular-nums">{formatDateTime(s.submittedAt, settings.timezone)}</TableCell>
                            {m.type.fields.map((f) => (
                              <TableCell key={f.key}>{displayValue(f, s.data[f.key])}</TableCell>
                            ))}
                            <TableCell>
                              {s.status === SubmissionStatus.Rejected ? (
                                <span className="flex flex-col gap-0.5">
                                  <StatusPill tone="alert" icon={Ban} label="Rejeté" />
                                  {s.rejectedReason && <span className="text-xs">« {s.rejectedReason} »</span>}
                                </span>
                              ) : (
                                <span className="text-sm">Accepté</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {s.status === SubmissionStatus.Accepted && (
                                <Button variant="ghost" size="sm" onClick={() => setRejecting(s)}>
                                  Rejeter
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <Pagination page={paged.page} pages={paged.pages} total={paged.total} pageSize={paged.pageSize} onPage={paged.setPage} />
              </QueryState>
            </section>
          </>
        )}
      </QueryState>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeter le formulaire</DialogTitle>
            <DialogDescription>Il ne comptera plus dans la progression. L'agent verra le motif.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="reject-submission">Motif</FieldLabel>
            <Textarea
              id="reject-submission"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="Ex. : visite en double"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Annuler
            </Button>
            <Button variant="destructive" disabled={!reason.trim() || reject.isPending} onClick={() => reject.mutate(undefined)}>
              {reject.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Rejeter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {m && <MissionEditDialog mission={m} open={editing} onOpenChange={setEditing} />}
      <RemoveDialog
        target={removing && m ? { name: m.title, isActive: m.isActive } : null}
        onOpenChange={setRemoving}
        config={
          m
            ? {
                noun: 'la mission',
                url: `/missions/${m.id}`,
                deactivateEffect: 'Les agents ne la voient plus et ne peuvent plus envoyer de formulaires.',
                impactLabels: IMPACT_LABELS.mission,
                invalidate: [['missions']],
                onRemoved: () => void navigate('/missions'),
              }
            : null
        }
      />
    </Page>
  )
}
