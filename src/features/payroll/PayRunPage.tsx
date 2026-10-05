import { AdjustmentStatus, PayRunStatus, Role } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  Lock,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Page, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { SearchInput } from '@/components/app/search-input'
import { StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDate, formatPhone, fullName } from '@/lib/format'
import { usePaged } from '@/lib/pagination'
import { useApiMutation } from '@/lib/queries'
import { formatMoney } from '@/lib/subscription'
import type { PayRunDetail, PayRunLine } from '@/lib/types'
import { cn } from '@/lib/utils'
import { RUN_TONE, exportAccounting, exportPayments, runStatusLabel } from './helpers'
import { ItemsList } from './PayrollPage'

export function PayRunPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useMe()
  const admin = user.role === Role.Admin
  const run = useQuery({ queryKey: ['pay', 'runs', id], queryFn: async () => (await api.get<PayRunDetail>(`/pay/runs/${id}`)).data })
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adjusting, setAdjusting] = useState<PayRunLine | null>(null)
  const [paying, setPaying] = useState<string[] | null>(null)

  const r = run.data
  const draft = r?.status === PayRunStatus.Draft
  const needle = search.trim().toLowerCase()
  const rows = useMemo(
    () =>
      (r?.lines ?? []).filter((l) => !needle || `${fullName(l)} ${l.groupName ?? ''} ${l.gridName ?? ''}`.toLowerCase().includes(needle)),
    [r, needle],
  )
  const paged = usePaged(rows, 20)
  const pending = (r?.adjustments ?? []).filter((a) => a.status === AdjustmentStatus.Proposed)
  const unpaid = (r?.lines ?? []).filter((l) => l.total > 0 && !l.paidAt)

  const invalidate = [['pay']]
  const recalc = useApiMutation(() => api.post(`/pay/runs/${id}/recalculate`), { success: 'Paie recalculée', invalidate })
  const validate = useApiMutation(() => api.post(`/pay/runs/${id}/validate`), {
    success: 'Paie validée : chacun a été prévenu de ses gains',
    invalidate,
  })
  const decide = useApiMutation(
    ({ adj, approve }: { adj: string; approve: boolean }) => api.post(`/pay/adjustments/${adj}/decision`, { approve }),
    {
      success: 'Décision enregistrée',
      invalidate,
    },
  )
  const removeAdj = useApiMutation((adj: string) => api.delete(`/pay/adjustments/${adj}`), { success: 'Ajustement retiré', invalidate })
  const name = (userId: string) => fullName(r?.lines.find((l) => l.userId === userId))

  return (
    <Page>
      <Link to="/pay" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Rémunération
      </Link>
      <QueryState query={run}>
        {r && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight first-letter:uppercase">
                  Paie de {r.label}
                  <StatusPill
                    tone={RUN_TONE[r.status]}
                    icon={r.status === 'paid' ? CheckCircle2 : r.status === 'validated' ? Lock : Clock}
                    label={runStatusLabel[r.status]}
                  />
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Du {formatDate(r.periodStart)} au {formatDate(r.periodEnd)} · calculée le {formatDate(r.computedAt)}
                  {r.validatedAt && ` · validée le ${formatDate(r.validatedAt)}`}
                </p>
              </div>
              {admin && (
                <div className="flex flex-wrap gap-2">
                  {draft && (
                    <>
                      <Button variant="outline" disabled={recalc.isPending} onClick={() => recalc.mutate(undefined)}>
                        <RefreshCw aria-hidden /> Recalculer
                      </Button>
                      <Button
                        disabled={validate.isPending || pending.length > 0}
                        title={pending.length ? 'Décidez d’abord les ajustements proposés' : undefined}
                        onClick={() => validate.mutate(undefined)}
                      >
                        <Lock aria-hidden /> Valider la paie
                      </Button>
                    </>
                  )}
                  {!draft && (
                    <>
                      <Button variant="outline" disabled={!unpaid.length} onClick={() => exportPayments(r)}>
                        <Download aria-hidden /> Fichier de paiement
                      </Button>
                      <Button variant="outline" onClick={() => exportAccounting(r)}>
                        <FileSpreadsheet aria-hidden /> Export comptable
                      </Button>
                      <Button disabled={!unpaid.length} onClick={() => setPaying(selected.size ? [...selected] : [])}>
                        <Check aria-hidden /> {selected.size ? `Marquer ${selected.size} payé(s)` : 'Tout marquer payé'}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <Kpi
                label="Net à payer"
                value={formatMoney(
                  r.lines.reduce((s, l) => s + l.total, 0),
                  r.currency,
                )}
              />
              <Kpi
                label="Calculé"
                value={formatMoney(
                  r.lines.reduce((s, l) => s + l.gross, 0),
                  r.currency,
                )}
              />
              <Kpi
                label="Ajustements"
                value={formatMoney(
                  r.lines.reduce((s, l) => s + l.adjustments, 0),
                  r.currency,
                )}
              />
              <Kpi label="Payé" value={`${r.lines.filter((l) => l.paidAt).length} / ${r.lines.filter((l) => l.total > 0).length}`} />
            </div>

            {pending.length > 0 && (
              <section className="rounded-lg border border-status-paused/30 bg-status-paused/5 p-4">
                <h2 className="mb-2 text-sm font-semibold">Ajustements proposés par les chefs d’équipe</h2>
                <ul className="flex flex-col gap-2">
                  {pending.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card px-3 py-2 text-sm">
                      <span>
                        <strong>{name(a.userId)}</strong> :{' '}
                        <span className={cn('tabular-nums', a.amount < 0 && 'text-status-alert')}>{formatMoney(a.amount, r.currency)}</span>{' '}
                        — {a.reason}
                        {a.proposedBy && <span className="text-xs text-muted-foreground"> (proposé par {a.proposedBy})</span>}
                      </span>
                      {admin && (
                        <span className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => decide.mutate({ adj: a.id, approve: false })}>
                            <X aria-hidden /> Refuser
                          </Button>
                          <Button size="sm" onClick={() => decide.mutate({ adj: a.id, approve: true })}>
                            <Check aria-hidden /> Accepter
                          </Button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Personne, groupe ou grille"
              label="Rechercher dans la paie"
              className="w-full sm:w-80"
            />

            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    {admin && !draft && (
                      <TableHead className="w-8">
                        <span className="sr-only">Sélection</span>
                      </TableHead>
                    )}
                    <TableHead className="w-8" />
                    <TableHead>Personne</TableHead>
                    <TableHead>Grille</TableHead>
                    <TableHead className="text-right">Calculé</TableHead>
                    <TableHead className="text-right">Ajustements</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Paiement</TableHead>
                    {draft && <TableHead className="w-24" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.items.map((l) => {
                    const adjs = r.adjustments.filter((a) => a.userId === l.userId)
                    return (
                      <Fragment key={l.id}>
                        <TableRow>
                          {admin && !draft && (
                            <TableCell>
                              <Checkbox
                                aria-label={`Sélectionner ${fullName(l)}`}
                                disabled={!!l.paidAt || l.total === 0}
                                checked={selected.has(l.userId)}
                                onCheckedChange={(v) => {
                                  const next = new Set(selected)
                                  if (v) next.add(l.userId)
                                  else next.delete(l.userId)
                                  setSelected(next)
                                }}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-expanded={open === l.id}
                              aria-label={`Détail de ${fullName(l)}`}
                              onClick={() => setOpen(open === l.id ? null : l.id)}
                            >
                              {open === l.id ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{fullName(l)}</div>
                            <div className="text-xs text-muted-foreground">
                              {l.role === Role.TeamLead ? 'Chef d’équipe' : 'Agent'}
                              {l.groupName && ` · ${l.groupName}`} · {formatPhone(l.phone)}
                            </div>
                          </TableCell>
                          <TableCell>{l.gridName ?? <span className="text-status-paused">Aucune</span>}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(l.gross, r.currency)}</TableCell>
                          <TableCell className={cn('text-right tabular-nums', l.adjustments < 0 && 'text-status-alert')}>
                            {l.adjustments ? formatMoney(l.adjustments, r.currency) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{formatMoney(l.total, r.currency)}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {l.paidAt ? (
                              <span className="text-status-active">
                                Payé le {formatDate(l.paidAt)}
                                {l.paymentReference && <span className="block text-xs text-muted-foreground">{l.paymentReference}</span>}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">{l.total > 0 ? 'À payer' : '—'}</span>
                            )}
                          </TableCell>
                          {draft && (
                            <TableCell>
                              <Button size="sm" variant="ghost" onClick={() => setAdjusting(l)}>
                                <SlidersHorizontal aria-hidden /> {admin ? 'Ajuster' : 'Proposer'}
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                        {open === l.id && (
                          <TableRow className="bg-muted/40 hover:bg-muted/40">
                            <TableCell colSpan={admin && !draft ? 2 : 1} />
                            <TableCell colSpan={draft ? 7 : 6}>
                              {l.items.length ? (
                                <ItemsList items={l.items} currency={r.currency} />
                              ) : (
                                <p className="text-sm text-muted-foreground">Aucun élément calculé.</p>
                              )}
                              {adjs.length > 0 && (
                                <ul className="mt-2 flex flex-col gap-1 border-t pt-2 text-sm">
                                  {adjs.map((a) => (
                                    <li
                                      key={a.id}
                                      className={cn(
                                        'flex items-center justify-between gap-2',
                                        a.status === AdjustmentStatus.Rejected && 'text-muted-foreground line-through',
                                      )}
                                    >
                                      <span>
                                        Ajustement : {a.reason}
                                        {a.status === AdjustmentStatus.Proposed && (
                                          <span className="text-xs text-status-paused"> (en attente)</span>
                                        )}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <span className={cn('tabular-nums', a.amount < 0 && 'text-status-alert')}>
                                          {formatMoney(a.amount, r.currency)}
                                        </span>
                                        {admin && draft && (
                                          <Button
                                            variant="ghost"
                                            size="icon-xs"
                                            aria-label="Retirer l’ajustement"
                                            onClick={() => removeAdj.mutate(a.id)}
                                          >
                                            <Trash2 aria-hidden />
                                          </Button>
                                        )}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <Pagination page={paged.page} pages={paged.pages} total={paged.total} pageSize={paged.pageSize} onPage={paged.setPage} />
          </>
        )}
      </QueryState>

      <AdjustDialog runId={id!} line={adjusting} admin={admin} currency={r?.currency ?? 'XOF'} onClose={() => setAdjusting(null)} />
      <PayDialog
        runId={id!}
        userIds={paying}
        count={paying?.length || unpaid.length}
        onClose={() => {
          setPaying(null)
          setSelected(new Set())
        }}
      />
    </Page>
  )
}

function AdjustDialog({
  runId,
  line,
  admin,
  currency,
  onClose,
}: {
  runId: string
  line: PayRunLine | null
  admin: boolean
  currency: string
  onClose: () => void
}) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const save = useApiMutation(
    () => api.post(`/pay/runs/${runId}/adjustments`, { userId: line!.userId, amount: Number(amount), reason: reason.trim() }),
    {
      success: admin ? 'Ajustement appliqué' : 'Ajustement proposé à l’administrateur',
      invalidate: [['pay']],
      onSuccess: () => {
        setAmount('')
        setReason('')
        onClose()
      },
    },
  )
  const value = Number(amount)
  return (
    <Dialog open={!!line} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {admin ? 'Ajuster' : 'Proposer un ajustement pour'} {fullName(line)}
          </DialogTitle>
          <DialogDescription>
            Montant positif pour une prime, négatif pour une retenue.{' '}
            {admin ? 'Il s’applique tout de suite.' : 'L’administrateur décidera.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-amount">Montant ({currency})</Label>
            <Input
              id="adj-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9-]/g, ''))}
              placeholder="Ex. 5000 ou -2000"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-reason">Motif (visible par la personne)</Label>
            <Textarea
              id="adj-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              placeholder="Ex. Prime de résultat exceptionnelle"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!value || reason.trim().length < 3 || save.isPending} onClick={() => save.mutate(undefined)}>
            {admin ? 'Appliquer' : 'Proposer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PayDialog({ runId, userIds, count, onClose }: { runId: string; userIds: string[] | null; count: number; onClose: () => void }) {
  const [reference, setReference] = useState('')
  const save = useApiMutation(
    () => api.post(`/pay/runs/${runId}/paid`, { userIds: userIds?.length ? userIds : undefined, reference: reference.trim() || undefined }),
    {
      success: 'Paiement enregistré : les personnes ont été prévenues',
      invalidate: [['pay']],
      onSuccess: () => {
        setReference('')
        onClose()
      },
    },
  )
  return (
    <Dialog open={userIds !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer le paiement</DialogTitle>
          <DialogDescription>
            À faire après avoir payé {count} personne{count > 1 ? 's' : ''} hors de la plateforme (Mobile Money, virement…). Chacune sera
            prévenue dans l’app.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pay-ref">Référence du paiement (facultatif)</Label>
          <Input
            id="pay-ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Ex. Lot Orange Money du 1er octobre"
            maxLength={120}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate(undefined)}>
            <Check aria-hidden /> Marquer payé
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
