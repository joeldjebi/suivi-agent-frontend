import { BillingCycle, SubscriptionStatus, type PlanCode } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Ban, CircleCheck, Info, Pencil, PlayCircle, Settings2, ShieldAlert, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Page, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Card, Chart } from '@/features/stats/components'
import { formatDate, formatPhone, formatRelative, fullName } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { platformApi } from '../api'
import { InvoiceStatusPill, Row, TenantStatus } from '../components'
import { to } from '../config'
import { PaymentDialog, VoidDialog } from '../invoice-dialogs'
import { formatMoney, monthLabel, paymentMethodLabel } from '../labels'
import { usePlanName } from '../plans'
import { ConfigTab } from '../tenant/ConfigTab'
import { FieldTab } from '../tenant/FieldTab'
import { JournalTab } from '../tenant/JournalTab'
import { TeamsTab } from '../tenant/TeamsTab'
import type { Invoice, Subscription, TenantAlert, TenantDetail } from '../types'

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))

const TABS = [
  ['overview', 'Vue d’ensemble'],
  ['teams', 'Équipes'],
  ['field', 'Terrain'],
  ['billing', 'Facturation'],
  ['config', 'Configuration'],
  ['journal', 'Journal'],
] as const
type Tab = (typeof TABS)[number][0]

/** Points d'attention, du plus grave au moins grave. */
function AlertsStrip({ alerts }: { alerts: TenantAlert[] }) {
  if (!alerts.length)
    return (
      <p className="flex items-center gap-2 rounded-lg border border-status-active/30 bg-status-active/5 px-3 py-2 text-sm text-status-active">
        <CircleCheck className="size-4" aria-hidden /> Aucun point d’attention
      </p>
    )
  const tone = {
    critical: 'border-status-alert/30 bg-status-alert/5 text-status-alert',
    warning: 'border-status-paused/30 bg-status-paused/5 text-status-paused',
    info: 'border-border bg-muted/40 text-muted-foreground',
  }
  const Icon = { critical: ShieldAlert, warning: AlertTriangle, info: Info }
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Points d’attention">
      {alerts.map((a) => {
        const I = Icon[a.level]
        return (
          <li key={a.code} className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-sm', tone[a.level])}>
            <I className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="text-foreground">{a.message}</span>
          </li>
        )
      })}
    </ul>
  )
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-semibold tabular-nums', tone)}>{value}</p>
    </div>
  )
}

export function TenantPage() {
  const { id } = useParams<{ id: string }>()
  const query = useQuery({
    queryKey: ['platform', 'tenant', id],
    queryFn: async () => (await platformApi.get<TenantDetail>(`/tenants/${id}`)).data,
  })
  return (
    <Page>
      <Link to={to('/tenants')} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Structures
      </Link>
      <QueryState query={query} rows={8}>
        {query.data && <Content d={query.data} />}
      </QueryState>
    </Page>
  )
}

function Content({ d }: { d: TenantDetail }) {
  const [editing, setEditing] = useState<'subscription' | 'info' | 'suspend' | 'reactivate' | null>(null)
  const [paying, setPaying] = useState<Invoice | null>(null)
  const [voiding, setVoiding] = useState<Invoice | null>(null)
  const sub = d.subscription
  const money = (v: number) => formatMoney(v, d.currency)
  const suspended = sub?.status === SubscriptionStatus.Suspended
  const pending = d.invoices.filter((i) => i.status === 'pending')
  const [now] = useState(Date.now)
  const overdue = pending.filter((i) => Date.parse(i.dueAt) < now)
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.some(([v]) => v === params.get('tab')) ? (params.get('tab') as Tab) : 'overview'
  const setTab = (next: Tab) => setParams(next === 'overview' ? {} : { tab: next }, { replace: true })

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{d.tenant.name}</h1>
            {sub && <TenantStatus status={sub.status} manual={sub.manualSuspension} />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Cliente depuis le {formatDate(d.tenant.createdAt)}
            {d.counts.lastActivity ? ` · dernière journée ${formatRelative(d.counts.lastActivity)}` : ' · aucune journée de travail'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditing('info')}>
            <Pencil aria-hidden /> Fiche
          </Button>
          {sub && (
            <Button variant="outline" onClick={() => setEditing('subscription')}>
              <Settings2 aria-hidden /> Abonnement
            </Button>
          )}
          {sub &&
            (suspended ? (
              <Button onClick={() => setEditing('reactivate')}>
                <PlayCircle aria-hidden /> Réactiver
              </Button>
            ) : (
              <Button variant="destructive" onClick={() => setEditing('suspend')}>
                <Ban aria-hidden /> Suspendre
              </Button>
            ))}
        </div>
      </div>

      <AlertsStrip alerts={d.alerts} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Fact label="Agents actifs" value={d.usage ? `${d.usage.agents.used} / ${d.usage.agents.limit}` : String(d.counts.activeAgents)} />
        <Fact label="Chefs d’équipe" value={d.usage ? `${d.usage.leads.used} / ${d.usage.leads.limit}` : String(d.counts.leads)} />
        <Fact label="Journées (30 j)" value={String(d.counts.daysLast30)} />
        <Fact label="Estimation du mois" value={d.estimate ? money(d.estimate.amount) : '—'} />
        <Fact
          label="Impayé échu"
          value={overdue.length ? money(overdue.reduce((sum, i) => sum + i.amount, 0)) : '—'}
          tone={overdue.length ? 'text-status-alert' : undefined}
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList>
            {TABS.map(([value, label]) => (
              <TabsTrigger key={value} value={value}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {tab === 'overview' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <Card title="Activité des 30 derniers jours">
              <Chart
                data={d.activity.map((a) => ({ label: dayLabel(a.date), days: a.days }))}
                dataKey="days"
                name="Journées de travail"
                height={200}
              />
            </Card>
            <Card title="En bref">
              <div className="grid gap-x-8 sm:grid-cols-2">
                <div className="divide-y">
                  <Row label="Cliente depuis">{formatDate(d.tenant.createdAt)}</Row>
                  <Row label="Dernière journée">{d.counts.lastActivity ? formatRelative(d.counts.lastActivity) : 'Jamais'}</Row>
                  <Row label="Agents (dont désactivés)">{d.counts.agents}</Row>
                </div>
                <div className="divide-y">
                  <Row label="Zones">{d.counts.zones}</Row>
                  <Row label="Groupes">{d.counts.groups}</Row>
                  <Row label="Missions">{d.counts.missions}</Row>
                </div>
              </div>
            </Card>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            {sub && <SubscriptionCard d={d} sub={sub} />}
            <Card title="Administrateurs" flush>
              <ul className="divide-y">
                {d.admins.map((a) => (
                  <li key={a.id} className="px-4 py-2.5 text-sm">
                    <p className="font-medium">
                      {fullName(a)}
                      {!a.isActive && <span className="ml-2 text-xs font-normal text-muted-foreground">désactivé</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.email}
                      {a.phone && ` · ${formatPhone(a.phone)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.lastLoginAt ? `Dernière connexion ${formatRelative(a.lastLoginAt)}` : 'Jamais connecté'}
                    </p>
                  </li>
                ))}
              </ul>
              {d.tenant.contactPhone && (
                <p className="border-t px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">Contact : </span>
                  <a href={`tel:${d.tenant.contactPhone}`} className="font-medium hover:underline">
                    {formatPhone(d.tenant.contactPhone)}
                  </a>
                </p>
              )}
            </Card>
            <NotesCard tenantId={d.tenant.id} notes={d.tenant.notes} />
          </div>
        </div>
      )}

      {tab === 'teams' && <TeamsTab tenantId={d.tenant.id} />}
      {tab === 'field' && <FieldTab tenantId={d.tenant.id} />}

      {tab === 'billing' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Card title="Factures" flush>
            {d.invoices.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Aucune facture pour l’instant.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mois</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.invoices.map((i) => (
                    <InvoiceRow key={i.id} invoice={i} onPay={() => setPaying(i)} onVoid={() => setVoiding(i)} />
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
          <div className="flex min-w-0 flex-col gap-4">
            {sub && <SubscriptionCard d={d} sub={sub} />}
            <Card title="Totaux">
              <div className="divide-y">
                <Row label="Payé">{money(d.invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0))}</Row>
                <Row label="En attente">{money(pending.reduce((sum, i) => sum + i.amount, 0))}</Row>
                <Row label="Annulé">{money(d.invoices.filter((i) => i.status === 'void').reduce((sum, i) => sum + i.amount, 0))}</Row>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'config' && <ConfigTab tenantId={d.tenant.id} />}
      {tab === 'journal' && <JournalTab tenantId={d.tenant.id} history={d.history} />}

      {/* Montées à l'ouverture : elles repartent toujours des valeurs à jour. */}
      {sub && editing === 'subscription' && <SubscriptionDialog open d={d} sub={sub} onClose={() => setEditing(null)} />}
      {editing === 'info' && <InfoDialog open d={d} onClose={() => setEditing(null)} />}
      <SuspendDialog open={editing === 'suspend'} d={d} onClose={() => setEditing(null)} />
      <ReactivateDialog open={editing === 'reactivate'} d={d} onClose={() => setEditing(null)} />
      <PaymentDialog invoice={paying} tenantName={d.tenant.name} onClose={() => setPaying(null)} />
      <VoidDialog invoice={voiding} onClose={() => setVoiding(null)} />
    </>
  )
}

function InvoiceRow({ invoice: i, onPay, onVoid }: { invoice: Invoice; onPay: () => void; onVoid: () => void }) {
  const planName = usePlanName()
  return (
    <TableRow>
      <TableCell>
        <p className="font-medium capitalize">{monthLabel(i.month)}</p>
        <p className="text-xs text-muted-foreground">
          {i.number} · {planName(i.planCode)}
          {i.prorataPercent < 100 && ` · prorata ${i.prorataPercent} %`}
          {i.discountPercent > 0 && ` · remise ${i.discountPercent} %`}
        </p>
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">{formatMoney(i.amount, i.currency)}</TableCell>
      <TableCell>
        <InvoiceStatusPill invoice={i} />
        <p className="mt-0.5 text-xs text-muted-foreground">
          {i.status === 'paid'
            ? `${formatDate(i.paidAt)}${i.paymentMethod ? ` · ${paymentMethodLabel[i.paymentMethod] ?? i.paymentMethod}` : ''}${i.paymentReference ? ` · ${i.paymentReference}` : ''}`
            : i.status === 'void'
              ? i.voidReason
              : `Échéance ${formatDate(i.dueAt)}`}
        </p>
      </TableCell>
      <TableCell className="text-right">
        {i.status === 'pending' && (
          <div className="flex justify-end gap-1">
            <Button size="sm" onClick={onPay}>
              Paiement reçu
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Annuler la facture ${i.number}`}
              title="Annuler la facture"
              onClick={onVoid}
            >
              <X aria-hidden />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

function SubscriptionCard({ d, sub }: { d: TenantDetail; sub: Subscription }) {
  const plan = d.plan
  const money = (v: number) => formatMoney(v, d.currency)
  const negotiated = sub.customMonthlyPrice !== null || sub.customIncludedAgents !== null || sub.customIncludedLeads !== null
  const usage = d.usage
  return (
    <Card
      title="Abonnement"
      actions={
        negotiated ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" aria-hidden /> Conditions négociées
          </span>
        ) : undefined
      }
    >
      <div className="divide-y">
        <Row label="Formule">
          {d.plan?.name ?? sub.planCode} · {sub.billingCycle === BillingCycle.Annual ? 'annuel' : 'mensuel'}
        </Row>
        {sub.status === SubscriptionStatus.Trialing && sub.trialEndsAt && (
          <Row label="Fin de l’essai">
            {formatDate(sub.trialEndsAt)} ({formatRelative(sub.trialEndsAt)})
          </Row>
        )}
        {sub.commitmentEndsAt && <Row label="Engagement jusqu’au">{formatDate(sub.commitmentEndsAt)}</Row>}
        <Row label="Forfait mensuel">
          {money(sub.customMonthlyPrice ?? plan?.monthlyPrice ?? 0)}
          {sub.customMonthlyPrice !== null && plan && (
            <span className="block text-xs font-normal text-muted-foreground line-through">{money(plan.monthlyPrice)}</span>
          )}
        </Row>
        <Row label="Agents supplémentaires">
          {sub.extraAgents} × {money(plan?.extraAgentPrice ?? 0)}
        </Row>
        {d.estimate && (
          <Row label={`Estimation ${monthLabel(d.estimate.month)}`}>
            {money(d.estimate.amount)}
            {(d.estimate.prorataPercent < 100 || d.estimate.discountPercent > 0) && (
              <span className="block text-xs font-normal text-muted-foreground">
                {d.estimate.prorataPercent < 100 && `prorata ${d.estimate.prorataPercent} %`}
                {d.estimate.prorataPercent < 100 && d.estimate.discountPercent > 0 && ' · '}
                {d.estimate.discountPercent > 0 && `remise ${d.estimate.discountPercent} %`}
              </span>
            )}
          </Row>
        )}
      </div>
      {usage && (
        <div className="mt-4 flex flex-col gap-3 border-t pt-4">
          <Quota label="Agents actifs" used={usage.agents.used} limit={usage.agents.limit} />
          <Quota label="Chefs d’équipe actifs" used={usage.leads.used} limit={usage.leads.limit} />
          {sub.status === SubscriptionStatus.Trialing && (
            <p className="text-xs text-muted-foreground">Pendant l’essai, les quotas sont ceux de la formule Entreprise.</p>
          )}
        </div>
      )}
    </Card>
  )
}

function Quota({ label, used, limit }: { label: string; used: number; limit: number }) {
  const over = used > limit
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className={cn('tabular-nums', over && 'font-semibold text-status-alert')}>
          {used} / {limit}
        </span>
      </div>
      <Progress value={limit ? Math.min(100, (used / limit) * 100) : 100} aria-label={label} />
    </div>
  )
}

function NotesCard({ tenantId, notes }: { tenantId: string; notes: string | null }) {
  const [value, setValue] = useState(notes ?? '')
  const save = useApiMutation(() => platformApi.patch(`/tenants/${tenantId}`, { notes: value }), {
    success: 'Notes enregistrées',
    invalidate: [['platform', 'tenant', tenantId]],
  })
  return (
    <Card title="Notes internes">
      <Textarea
        aria-label="Notes internes"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={4000}
        rows={4}
        placeholder="Contrat, interlocuteurs, relances… Jamais visibles par la structure."
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" variant="outline" disabled={value === (notes ?? '') || save.isPending} onClick={() => save.mutate(undefined)}>
          Enregistrer
        </Button>
      </div>
    </Card>
  )
}

/** Champ numérique facultatif : vide = conditions de la formule. */
function OptionalNumber({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} inputMode="numeric" value={value} placeholder={hint} onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))} />
    </div>
  )
}

function SubscriptionDialog({ open, d, sub, onClose }: { open: boolean; d: TenantDetail; sub: Subscription; onClose: () => void }) {
  const initial = () => ({
    planCode: sub.planCode,
    billingCycle: sub.billingCycle,
    extraAgents: String(sub.extraAgents),
    price: sub.customMonthlyPrice?.toString() ?? '',
    agents: sub.customIncludedAgents?.toString() ?? '',
    leads: sub.customIncludedLeads?.toString() ?? '',
    trialEndsAt: sub.trialEndsAt?.slice(0, 10) ?? '',
  })
  const [v, setV] = useState(initial)
  const [negotiate, setNegotiate] = useState(
    sub.customMonthlyPrice !== null || sub.customIncludedAgents !== null || sub.customIncludedLeads !== null,
  )
  const plan = d.plans.find((p) => p.code === v.planCode)
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const trialing = sub.status === SubscriptionStatus.Trialing
  const close = () => {
    setV(initial())
    onClose()
  }
  const num = (s: string) => (s === '' ? null : Number(s))
  const save = useApiMutation(
    async () =>
      (
        await platformApi.patch<{ warnings: string[] }>(`/tenants/${d.tenant.id}/subscription`, {
          planCode: v.planCode,
          billingCycle: v.billingCycle,
          extraAgents: Number(v.extraAgents || 0),
          customMonthlyPrice: negotiate ? num(v.price) : null,
          customIncludedAgents: negotiate ? num(v.agents) : null,
          customIncludedLeads: negotiate ? num(v.leads) : null,
          trialEndsAt:
            trialing && v.trialEndsAt && v.trialEndsAt !== sub.trialEndsAt?.slice(0, 10)
              ? new Date(`${v.trialEndsAt}T23:59:00`).toISOString()
              : undefined,
        })
      ).data,
    {
      success: 'Abonnement mis à jour',
      invalidate: [['platform']],
      onSuccess: (result) => {
        for (const warning of result.warnings) toast.warning(`Quota dépassé : ${warning}. La structure ne pourra plus ajouter de comptes.`)
        onClose()
      },
    },
  )
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Abonnement de {d.tenant.name}</DialogTitle>
          <DialogDescription>
            S’applique aux prochaines factures. Les quotas changent tout de suite ; un dépassement n’est pas bloqué mais signalé.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Formule</Label>
            <Select value={v.planCode} onValueChange={(x) => x && setV({ ...v, planCode: x as PlanCode })}>
              <SelectTrigger className="w-full" aria-label="Formule">
                <SelectValue>{(x: PlanCode) => d.plans.find((p) => p.code === x)?.name ?? x}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {d.plans.map((p) => (
                  <SelectItem key={p.code} value={p.code}>
                    {p.name} · {formatMoney(p.monthlyPrice, d.currency)}
                    {!p.isActive && ' (retirée)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Facturation</Label>
            <Select value={v.billingCycle} onValueChange={(x) => x && setV({ ...v, billingCycle: x as BillingCycle })}>
              <SelectTrigger className="w-full" aria-label="Facturation">
                <SelectValue>{(x: string) => (x === 'annual' ? 'Engagement annuel' : 'Mensuelle')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensuelle</SelectItem>
                <SelectItem value="annual">Engagement annuel (12 mois)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sub-extra">Agents supplémentaires</Label>
            <Input
              id="sub-extra"
              inputMode="numeric"
              value={v.extraAgents}
              onChange={(e) => setV({ ...v, extraAgents: e.target.value.replace(/\D/g, '') })}
            />
          </div>
          {trialing && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sub-trial">Fin de l’essai</Label>
              <Input
                id="sub-trial"
                type="date"
                min={today}
                value={v.trialEndsAt}
                onChange={(e) => setV({ ...v, trialEndsAt: e.target.value })}
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Switch checked={negotiate} onCheckedChange={setNegotiate} />
            Conditions négociées (prix ou quotas propres à ce client)
          </label>
          {negotiate && (
            <>
              <OptionalNumber
                id="sub-price"
                label="Forfait mensuel"
                hint={plan ? `${plan.monthlyPrice} (formule)` : ''}
                value={v.price}
                onChange={(x) => setV({ ...v, price: x })}
              />
              <OptionalNumber
                id="sub-agents"
                label="Agents inclus"
                hint={plan ? `${plan.includedAgents} (formule)` : ''}
                value={v.agents}
                onChange={(x) => setV({ ...v, agents: x })}
              />
              <OptionalNumber
                id="sub-leads"
                label="Chefs d’équipe inclus"
                hint={plan ? `${plan.includedLeads} (formule)` : ''}
                value={v.leads}
                onChange={(x) => setV({ ...v, leads: x })}
              />
              <p className="self-end text-xs text-muted-foreground">
                Champ vide : valeur de la formule. La structure ne pourra plus changer seule de formule.
              </p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Annuler
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate(undefined)}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InfoDialog({ open, d, onClose }: { open: boolean; d: TenantDetail; onClose: () => void }) {
  const [name, setName] = useState(d.tenant.name)
  const [phone, setPhone] = useState(d.tenant.contactPhone ?? '')
  const save = useApiMutation(() => platformApi.patch(`/tenants/${d.tenant.id}`, { name: name.trim(), contactPhone: phone.trim() }), {
    success: 'Fiche mise à jour',
    invalidate: [['platform']],
    onSuccess: onClose,
  })
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fiche de la structure</DialogTitle>
          <DialogDescription>Le nom apparaît dans l’espace de la structure et sur ses factures.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="info-name">Nom</Label>
            <Input id="info-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="info-phone">Téléphone de contact</Label>
            <Input id="info-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07 07 07 07 07" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate(undefined)}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SuspendDialog({ open, d, onClose }: { open: boolean; d: TenantDetail; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const save = useApiMutation(() => platformApi.post(`/tenants/${d.tenant.id}/suspend`, { reason: reason.trim() }), {
    success: 'Structure suspendue : ses administrateurs ont été prévenus',
    invalidate: [['platform']],
    onSuccess: () => {
      setReason('')
      onClose()
    },
  })
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Suspendre {d.tenant.name} ?</DialogTitle>
          <DialogDescription>
            Ses administrateurs, chefs d’équipe et agents perdent l’accès immédiatement (seuls l’abonnement et les factures restent
            visibles). Le motif leur est envoyé.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="suspend-reason">Motif (visible par la structure)</Label>
          <Textarea
            id="suspend-reason"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. Contrat résilié au 30 septembre"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="destructive" disabled={reason.trim().length < 3 || save.isPending} onClick={() => save.mutate(undefined)}>
            Suspendre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReactivateDialog({ open, d, onClose }: { open: boolean; d: TenantDetail; onClose: () => void }) {
  const save = useApiMutation(async () => (await platformApi.post<Subscription>(`/tenants/${d.tenant.id}/reactivate`)).data, {
    invalidate: [['platform']],
    onSuccess: (sub) => {
      if (sub.status === SubscriptionStatus.Suspended)
        toast.warning('Réactivée, mais des factures restent échues depuis trop longtemps : la structure est de nouveau suspendue.')
      else toast.success('Structure réactivée : l’accès est rétabli')
      onClose()
    },
  })
  const [now] = useState(Date.now)
  const overdue = d.invoices.filter((i) => i.status === 'pending' && Date.parse(i.dueAt) < now)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Réactiver {d.tenant.name} ?</DialogTitle>
          <DialogDescription>
            L’accès est rétabli pour tous ses comptes.
            {overdue.length > 0 &&
              ` Attention : ${overdue.length} facture${overdue.length > 1 ? 's' : ''} échue${overdue.length > 1 ? 's' : ''}. Enregistrez d’abord les paiements reçus, sinon la structure peut être suspendue à nouveau automatiquement.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate(undefined)}>
            Réactiver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
