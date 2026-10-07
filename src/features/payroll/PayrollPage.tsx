import { PayPeriod, Role } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronRight,
  Calculator,
  CheckCircle2,
  CircleDashed,
  Clock,
  Coins,
  PenLine,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { SearchInput } from '@/components/app/search-input'
import { StatusPill } from '@/components/app/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDate, fullName } from '@/lib/format'
import { usePaged } from '@/lib/pagination'
import { useApiMutation } from '@/lib/queries'
import { formatMoney } from '@/lib/subscription'
import type { PayEstimate, PayGrid, PayRunSummary } from '@/lib/types'
import { cn } from '@/lib/utils'
import { GridDialog } from './GridDialog'
import { RUN_TONE, describeGrid, periodKindLabel, runStatusLabel } from './helpers'
import { useOpenFromQuery } from '@/lib/use-open-from-query'

type Tab = 'current' | 'runs' | 'grids' | 'settings'

export function PayrollPage() {
  const { user } = useMe()
  const admin = user.role === Role.Admin
  const [tab, setTab] = useState<Tab>('current')
  return (
    <Page>
      <PageHeader
        title="Rémunération"
        description="Gains calculés automatiquement à partir de l’activité réelle. Les paiements se font hors de la plateforme (Mobile Money, banque), puis sont enregistrés ici."
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="current">Période en cours</TabsTrigger>
          <TabsTrigger value="runs">Paies</TabsTrigger>
          {admin && <TabsTrigger value="grids">Grilles</TabsTrigger>}
          {admin && <TabsTrigger value="settings">Réglages</TabsTrigger>}
        </TabsList>
      </Tabs>
      {tab === 'current' && <CurrentTab />}
      {tab === 'runs' && <RunsTab admin={admin} />}
      {tab === 'grids' && admin && <GridsTab />}
      {tab === 'settings' && admin && <SettingsTab />}
    </Page>
  )
}

/** Estimation en direct : recalculée à chaque ouverture. */
function CurrentTab() {
  const query = useQuery({ queryKey: ['pay', 'current'], queryFn: async () => (await api.get<PayEstimate>('/pay/current')).data })
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const d = query.data
  const needle = search.trim().toLowerCase()
  const rows = useMemo(() => (d?.lines ?? []).filter((l) => !needle || fullName(l.user).toLowerCase().includes(needle)), [d, needle])
  const paged = usePaged(rows, 20)
  const noGrid = (d?.lines ?? []).filter((l) => !l.gridId).length

  return (
    <QueryState query={query}>
      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi icon={Clock} label="Période" value={d.label} hint={`${formatDate(d.start)} → ${formatDate(d.end)}`} capitalize />
            <Kpi
              icon={Coins}
              label="Total estimé"
              value={formatMoney(d.total, d.currency)}
              hint={`${d.lines.filter((l) => l.gross > 0).length} personne(s) rémunérée(s)`}
            />
            <Kpi
              icon={CircleDashed}
              label="Sans grille"
              value={String(noGrid)}
              hint={noGrid ? 'Attribuez-leur une grille pour calculer leurs gains' : 'Tout le monde a une grille'}
              tone={noGrid ? 'text-status-paused' : undefined}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Rechercher une personne"
              label="Rechercher une personne"
              className="w-full sm:w-72"
            />
            <p className="text-xs text-muted-foreground">
              Estimation mise à jour en direct ; la paie est préparée automatiquement à la fin de la période.
            </p>
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={Wallet} title="Personne à rémunérer" description="Créez une grille dans l’onglet « Grilles »." />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Personne</TableHead>
                    <TableHead>Grille</TableHead>
                    <TableHead className="text-right">Estimation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.items.map((l) => (
                    <Fragment key={l.user.id}>
                      <TableRow>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-expanded={open === l.user.id}
                            aria-label={`Détail de ${fullName(l.user)}`}
                            disabled={!l.items.length}
                            onClick={() => setOpen(open === l.user.id ? null : l.user.id)}
                          >
                            {open === l.user.id ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{fullName(l.user)}</div>
                          <div className="text-xs text-muted-foreground">{l.user.role === Role.TeamLead ? 'Chef d’équipe' : 'Agent'}</div>
                        </TableCell>
                        <TableCell>{l.gridName ?? <span className="text-status-paused">Aucune grille</span>}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatMoney(l.gross, d.currency)}</TableCell>
                      </TableRow>
                      {open === l.user.id && (
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableCell />
                          <TableCell colSpan={3}>
                            <ItemsList items={l.items} currency={d.currency} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Pagination page={paged.page} pages={paged.pages} total={paged.total} pageSize={paged.pageSize} onPage={paged.setPage} />
        </>
      )}
    </QueryState>
  )
}

export function ItemsList({
  items,
  currency,
}: {
  items: { code: string; label: string; quantity: number | null; unitAmount: number | null; amount: number }[]
  currency: string
}) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {items.map((i) => (
        <li key={i.code} className="flex justify-between gap-4">
          <span>
            {i.label}
            {i.quantity !== null && i.unitAmount !== null && (
              <span className="text-muted-foreground">
                {' '}
                · {i.quantity} × {formatMoney(Math.abs(i.unitAmount), currency)}
              </span>
            )}
          </span>
          <span className={cn('tabular-nums', i.amount < 0 && 'text-status-alert')}>{formatMoney(i.amount, currency)}</span>
        </li>
      ))}
    </ul>
  )
}

function RunsTab({ admin }: { admin: boolean }) {
  const runs = useQuery({ queryKey: ['pay', 'runs'], queryFn: async () => (await api.get<PayRunSummary[]>('/pay/runs')).data })
  const [date, setDate] = useState('')
  const create = useApiMutation((d: string) => api.post('/pay/runs', { date: d || undefined }), {
    success: 'Paie calculée',
    invalidate: [['pay']],
    onSuccess: () => setDate(''),
  })
  const paged = usePaged(runs.data ?? [], 12)
  return (
    <>
      {admin && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="run-date">Calculer la paie d’une période terminée</Label>
            <Input id="run-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48" />
          </div>
          <Button disabled={create.isPending} onClick={() => create.mutate(date)}>
            <Calculator aria-hidden /> {date ? 'Calculer cette période' : 'Calculer la période précédente'}
          </Button>
          <p className="text-xs text-muted-foreground">La paie de la période écoulée est aussi préparée automatiquement.</p>
        </div>
      )}
      <QueryState query={runs}>
        {!runs.data?.length ? (
          <EmptyState
            icon={Wallet}
            title="Aucune paie pour le moment"
            description="La première paie sera préparée à la fin de la période en cours."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Période</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Personnes</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Suivi</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.items.map((r) => (
                  <TableRow key={r.id} className="relative">
                    <TableCell>
                      <Link
                        to={`/pay/runs/${r.id}`}
                        className="font-medium first-letter:uppercase after:absolute after:inset-0 hover:underline"
                      >
                        {r.label}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(r.periodStart)} → {formatDate(r.periodEnd)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        tone={RUN_TONE[r.status]}
                        icon={r.status === 'paid' ? CheckCircle2 : Clock}
                        label={runStatusLabel[r.status]}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.lines}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatMoney(r.total)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.pending > 0 && <div className="text-status-paused">{r.pending} ajustement(s) à décider</div>}
                      {r.status !== 'draft' && (
                        <div>
                          {r.paidLines} / {r.lines} payé{r.paidLines > 1 ? 's' : ''}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Pagination page={paged.page} pages={paged.pages} total={paged.total} pageSize={paged.pageSize} onPage={paged.setPage} />
      </QueryState>
    </>
  )
}

function GridsTab() {
  const grids = useQuery({ queryKey: ['pay', 'grids'], queryFn: async () => (await api.get<PayGrid[]>('/pay/grids')).data })
  const [dialog, setDialog] = useState<{ open: boolean; grid?: PayGrid }>({ open: false })
  useOpenFromQuery(() => setDialog({ open: true }))
  const remove = useApiMutation((id: string) => api.delete(`/pay/grids/${id}`), { success: 'Grille supprimée', invalidate: [['pay']] })
  const roleLabel = (r: string) => (r === 'agent' ? 'Tous les agents' : 'Tous les chefs')
  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ open: true })}>
          <Plus aria-hidden /> Nouvelle grille
        </Button>
      </div>
      <QueryState query={grids}>
        {!grids.data?.length ? (
          <EmptyState
            icon={Wallet}
            title="Aucune grille"
            description="Une grille décrit comment calculer les gains : fixe, journées, formulaires, primes, retenues."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {grids.data.map((g) => (
              <article
                key={g.id}
                className={cn('flex flex-col gap-3 rounded-lg border bg-card p-4', !g.isActive && 'border-dashed opacity-70')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{g.name}</h2>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(g.targets.roles ?? []).map((r) => (
                        <Badge key={r} variant="secondary">
                          {roleLabel(r)}
                        </Badge>
                      ))}
                      {(g.targets.groupIds?.length ?? 0) > 0 && <Badge variant="secondary">{g.targets.groupIds!.length} groupe(s)</Badge>}
                      {(g.targets.userIds?.length ?? 0) > 0 && <Badge variant="secondary">{g.targets.userIds!.length} personne(s)</Badge>}
                      {!g.isActive && <Badge variant="outline">Inactive</Badge>}
                    </div>
                  </div>
                  <div className="flex">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Modifier ${g.name}`}
                      onClick={() => setDialog({ open: true, grid: g })}
                    >
                      <PenLine aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Supprimer ${g.name}`}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(g.id)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>
                <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                  {describeGrid(g.components).map((p) => (
                    <li key={p}>• {p}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </QueryState>
      <GridDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} grid={dialog.grid} />
    </>
  )
}

function SettingsTab() {
  const settings = useQuery({
    queryKey: ['pay', 'settings'],
    queryFn: async () => (await api.get<{ period: PayPeriod }>('/pay/settings')).data,
  })
  const save = useApiMutation((period: PayPeriod) => api.patch('/pay/settings', { period }), {
    success: 'Période de paie enregistrée',
    invalidate: [['pay']],
  })
  return (
    <QueryState query={settings}>
      {settings.data && (
        <div className="flex max-w-md flex-col gap-2 rounded-lg border bg-card p-4">
          <Label>Période de paie</Label>
          <Select value={settings.data.period} onValueChange={(v) => v && save.mutate(v as PayPeriod)}>
            <SelectTrigger className="w-full" aria-label="Période de paie">
              <SelectValue>{(v: PayPeriod) => periodKindLabel[v]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.values(PayPeriod).map((p) => (
                <SelectItem key={p} value={p}>
                  {periodKindLabel[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Une paie est préparée à la fin de chaque période. Changer de période s’applique aux prochaines paies.
          </p>
        </div>
      )}
    </QueryState>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  capitalize,
}: {
  icon: typeof Coins
  label: string
  value: string
  hint?: string
  tone?: string
  capitalize?: boolean
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {label}
      </p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', capitalize && 'first-letter:uppercase', tone)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
