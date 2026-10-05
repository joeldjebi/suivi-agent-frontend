import { BillingCycle, InvoiceStatus, SubscriptionStatus, type PlanCode } from '@suivi/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleDashed,
  Clock,
  CreditCard,
  FileText,
  Minus,
  Plus,
  Receipt,
  Sparkles,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, errorCode, errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { BASE_FEATURES, featureLabel, formatMoney, planName, subscriptionStatusLabel } from '@/lib/subscription'
import type { Invoice, Plan, SubscriptionDetails } from '@/lib/types'
import { cn } from '@/lib/utils'

const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month.slice(0, 7)}-15T12:00:00Z`),
  )

const STATUS_TONE: Record<SubscriptionStatus, 'active' | 'info' | 'paused' | 'alert' | 'ended'> = {
  trialing: 'info',
  active: 'active',
  past_due: 'paused',
  suspended: 'alert',
  cancelled: 'ended',
}

export function SubscriptionPage() {
  const { reload } = useAuth()
  const queryClient = useQueryClient()
  const details = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => (await api.get<SubscriptionDetails>('/subscription')).data,
  })
  const invoices = useQuery({
    queryKey: ['subscription', 'invoices'],
    queryFn: async () => (await api.get<Invoice[]>('/subscription/invoices')).data,
  })
  const [choice, setChoice] = useState<{ plan: Plan; cycle: BillingCycle } | null>(null)
  const [blocking, setBlocking] = useState<string[] | null>(null)
  const [cycleView, setCycleView] = useState<BillingCycle | null>(null)
  const [now] = useState(Date.now)
  const [extra, setExtra] = useState<number | null>(null)
  // Noms des formules du catalogue (y compris celles créées par l'éditeur).
  const plans = new Map((details.data?.plans ?? []).map((p) => [p.code, p.name]))

  const change = useMutation({
    mutationFn: async (input: { planCode?: PlanCode; billingCycle?: BillingCycle; extraAgents?: number }) =>
      (await api.patch<SubscriptionDetails>('/subscription', input)).data,
    onSuccess: async (data) => {
      queryClient.setQueryData(['subscription'], data)
      setChoice(null)
      toast.success('Abonnement mis à jour')
      // Les fonctionnalités ouvertes changent : le menu et les pages s'adaptent.
      await reload()
    },
    onError: (error) => {
      if (errorCode(error) === 'PLAN_DOWNGRADE_BLOCKED') {
        const body = (error as { response?: { data?: { blocking?: string[] } } }).response?.data
        setBlocking(body?.blocking ?? [])
        setChoice(null)
        return
      }
      toast.error(errorMessage(error))
    },
  })

  const d = details.data
  const sub = d?.subscription
  const cycle = cycleView ?? sub?.billingCycle ?? BillingCycle.Monthly
  const committed = !!sub?.commitmentEndsAt && new Date(sub.commitmentEndsAt).getTime() > now
  const discounted = (amount: number) =>
    cycle === BillingCycle.Annual ? Math.round((amount * (100 - (d?.annualDiscountPercent ?? 0))) / 100) : amount
  const priceFor = (p: Plan) => discounted(p.monthlyPrice)
  const extraTotal = d && extra !== null ? discounted(extra * d.plan.extraAgentPrice) : 0

  return (
    <Page>
      <PageHeader
        title="Abonnement"
        description="Votre formule, son coût et vos factures. Chaque formule est un forfait mensuel qui inclut un nombre de chefs d’équipe et d’agents."
      />

      <QueryState query={details}>
        {d && sub && (
          <>
            {sub.status === SubscriptionStatus.Suspended && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-status-alert/30 bg-status-alert/5 p-4 text-sm text-status-alert"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-medium">Abonnement suspendu</p>
                  <p>
                    Vos agents et chefs d’équipe n’ont plus accès à l’application. Réglez les factures en attente pour rétablir l’accès.
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border bg-card p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CreditCard className="size-4" aria-hidden /> Formule actuelle
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold">
                  {d.plan.name}
                  <StatusPill
                    tone={STATUS_TONE[sub.status]}
                    icon={sub.status === SubscriptionStatus.Trialing ? Sparkles : CheckCircle2}
                    label={subscriptionStatusLabel[sub.status]}
                  />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sub.billingCycle === BillingCycle.Annual
                    ? `Engagement annuel (−${d.annualDiscountPercent} %)`
                    : 'Sans engagement, mensuel'}
                  {committed && ` jusqu’au ${formatDate(sub.commitmentEndsAt)}`}
                </p>
                {d.trialDaysLeft !== null && (
                  <p className="mt-2 text-sm text-primary">
                    Essai gratuit : {d.trialDaysLeft} jour{d.trialDaysLeft > 1 ? 's' : ''} restant{d.trialDaysLeft > 1 ? 's' : ''}, toutes
                    les fonctionnalités incluses.
                  </p>
                )}
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" aria-hidden /> Estimation de {monthLabel(d.estimate.month)}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(d.estimate.amount, d.currency)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Forfait {formatMoney(d.estimate.basePrice, d.currency)}
                  {d.estimate.extraAgents > 0 &&
                    ` + ${d.estimate.extraAgents} agent${d.estimate.extraAgents > 1 ? 's' : ''} × ${formatMoney(d.estimate.extraAgentPrice, d.currency)}`}
                  {d.estimate.discountPercent > 0 && ` − ${d.estimate.discountPercent} %`}
                  {d.estimate.prorataPercent < 100 && ` · ${d.estimate.prorataPercent} % du mois (après l’essai)`}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4" aria-hidden /> Comptes utilisés
                </p>
                <Quota label="Agents" used={d.usage.agents.used} limit={d.usage.agents.limit} />
                <Quota label="Chefs d’équipe" used={d.usage.leads.used} limit={d.usage.leads.limit} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {d.usage.agents.included} agents inclus
                  {d.usage.agents.extra > 0 && ` + ${d.usage.agents.extra} supplémentaire${d.usage.agents.extra > 1 ? 's' : ''}`}
                  {d.trialDaysLeft !== null && ' · quotas Entreprise pendant l’essai'}
                </p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => setExtra(d.usage.agents.extra)}>
                  <UserPlus aria-hidden /> Agents supplémentaires
                </Button>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Receipt className="size-4" aria-hidden /> À régler
                </p>
                <p className={cn('mt-1 text-2xl font-semibold tabular-nums', d.unpaid.count > 0 && 'text-status-paused')}>
                  {formatMoney(d.unpaid.amount, d.currency)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {d.unpaid.count === 0
                    ? 'Aucune facture en attente'
                    : `${d.unpaid.count} facture${d.unpaid.count > 1 ? 's' : ''} en attente`}
                </p>
              </div>
            </div>

            <section aria-labelledby="plans-title" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="plans-title" className="font-semibold">
                  Formules
                </h2>
                <div className="inline-flex rounded-lg border bg-card p-0.5" role="group" aria-label="Facturation">
                  {[BillingCycle.Monthly, BillingCycle.Annual].map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={cycle === c}
                      onClick={() => setCycleView(c)}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                        cycle === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {c === BillingCycle.Monthly ? 'Mensuel' : `Annuel −${d.annualDiscountPercent} %`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                {d.plans.map((p) => {
                  const current = p.code === sub.planCode && cycle === sub.billingCycle
                  const blockedByCommitment = committed && cycle === BillingCycle.Monthly
                  return (
                    <div
                      key={p.code}
                      className={cn(
                        'flex flex-col rounded-lg border bg-card p-5',
                        p.code === sub.planCode && 'border-primary ring-1 ring-primary',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-lg font-semibold">{p.name}</h3>
                        {p.code === sub.planCode && <span className="text-xs font-medium text-primary">Votre formule</span>}
                      </div>
                      <p className="mt-1 min-h-10 text-sm text-muted-foreground">{p.description}</p>
                      <p className="mt-3">
                        <span className="text-3xl font-semibold tabular-nums">{formatMoney(priceFor(p), d.currency)}</span>
                        <span className="text-sm text-muted-foreground"> / mois</span>
                      </p>
                      {cycle === BillingCycle.Annual && (
                        <p className="text-xs text-muted-foreground line-through">{formatMoney(p.monthlyPrice, d.currency)}</p>
                      )}
                      <p className="mt-2 rounded-md bg-muted px-2.5 py-1.5 text-sm">
                        <strong>
                          {p.includedLeads} chef{p.includedLeads > 1 ? 's' : ''} d’équipe · {p.includedAgents} agents
                        </strong>{' '}
                        inclus
                        <span className="block text-xs text-muted-foreground">
                          + {formatMoney(discounted(p.extraAgentPrice), d.currency)} par agent supplémentaire et par mois
                        </span>
                      </p>
                      <ul className="mt-4 flex flex-1 flex-col gap-1.5 text-sm">
                        {BASE_FEATURES.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check className="mt-0.5 size-4 shrink-0 text-status-active" aria-hidden /> {f}
                          </li>
                        ))}
                        {Object.entries(featureLabel).map(([key, label]) => {
                          const included = p.features.includes(key as never)
                          return (
                            <li key={key} className={cn('flex items-start gap-2', !included && 'text-muted-foreground')}>
                              {included ? (
                                <Check className="mt-0.5 size-4 shrink-0 text-status-active" aria-hidden />
                              ) : (
                                <CircleDashed className="mt-0.5 size-4 shrink-0" aria-hidden />
                              )}
                              <span className={cn(!included && 'line-through decoration-muted-foreground/40')}>{label}</span>
                              <span className="sr-only">{included ? '(inclus)' : '(non inclus)'}</span>
                            </li>
                          )
                        })}
                      </ul>
                      <Button
                        className="mt-5"
                        variant={current ? 'outline' : 'default'}
                        disabled={current || blockedByCommitment || change.isPending}
                        onClick={() => setChoice({ plan: p, cycle })}
                      >
                        {current ? 'Formule actuelle' : blockedByCommitment ? 'Engagement annuel en cours' : `Choisir ${p.name}`}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </QueryState>

      <section aria-labelledby="invoices-title" className="flex flex-col gap-3">
        <h2 id="invoices-title" className="font-semibold">
          Factures
        </h2>
        <QueryState query={invoices}>
          {invoices.data && invoices.data.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Aucune facture pour le moment"
              description="Une facture est émise au début de chaque mois pour le mois écoulé."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facture</TableHead>
                    <TableHead>Mois</TableHead>
                    <TableHead>Formule</TableHead>
                    <TableHead>Détail</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Échéance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.data?.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono text-xs">{i.number}</TableCell>
                      <TableCell className="first-letter:uppercase">{monthLabel(i.month)}</TableCell>
                      <TableCell>
                        {plans.get(i.planCode) ?? planName(i.planCode)}
                        {i.billingCycle === BillingCycle.Annual && <span className="text-xs text-muted-foreground"> · annuel</span>}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        Forfait {formatMoney(i.basePrice, i.currency)}
                        {i.extraAgents > 0 && ` + ${i.extraAgents} × ${formatMoney(i.extraAgentPrice, i.currency)}`}
                        <div className="text-xs text-muted-foreground">
                          {[
                            `${i.agents} agent${i.agents > 1 ? 's' : ''} actif${i.agents > 1 ? 's' : ''}`,
                            i.discountPercent > 0 && `−${i.discountPercent} %`,
                            i.prorataPercent < 100 && `${i.prorataPercent} % du mois`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatMoney(i.amount, i.currency)}</TableCell>
                      <TableCell>
                        {i.status === InvoiceStatus.Paid ? (
                          <StatusPill tone="active" icon={CheckCircle2} label="Payée" />
                        ) : i.status === InvoiceStatus.Void ? (
                          <StatusPill tone="ended" icon={XCircle} label="Annulée" />
                        ) : new Date(i.dueAt).getTime() < now ? (
                          <StatusPill tone="alert" icon={AlertTriangle} label="En retard" />
                        ) : (
                          <StatusPill tone="paused" icon={Clock} label="À régler" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                        {i.paidAt ? `Payée le ${formatDate(i.paidAt)}` : `Avant le ${formatDate(i.dueAt)}`}
                        {i.paymentReference && <div className="text-xs">{i.paymentReference}</div>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </QueryState>
        <p className="text-xs text-muted-foreground">
          Pour régler une facture (Mobile Money ou virement), contactez l’éditeur de la plateforme ; le paiement est enregistré sous 24 h.
        </p>
      </section>

      <Dialog open={!!choice} onOpenChange={(o) => !o && setChoice(null)}>
        <DialogContent>
          {choice && d && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Passer à la formule {choice.plan.name}
                  {choice.cycle === BillingCycle.Annual ? ' (annuel)' : ''} ?
                </DialogTitle>
                <DialogDescription>
                  {formatMoney(priceFor(choice.plan), d.currency)} par mois pour {choice.plan.includedLeads} chef
                  {choice.plan.includedLeads > 1 ? 's' : ''} d’équipe et {choice.plan.includedAgents} agents, appliqué dès la prochaine
                  facture.
                  {choice.cycle === BillingCycle.Annual &&
                    sub?.billingCycle !== BillingCycle.Annual &&
                    ` L’engagement annuel vous lie pour 12 mois, avec ${d.annualDiscountPercent} % de remise sur chaque facture.`}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setChoice(null)}>
                  Annuler
                </Button>
                <Button
                  disabled={change.isPending}
                  onClick={() => change.mutate({ planCode: choice.plan.code, billingCycle: choice.cycle })}
                >
                  Confirmer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={extra !== null} onOpenChange={(o) => !o && setExtra(null)}>
        <DialogContent className="sm:max-w-md">
          {d && extra !== null && (
            <>
              <DialogHeader>
                <DialogTitle>Agents supplémentaires</DialogTitle>
                <DialogDescription>
                  Votre formule inclut {d.usage.agents.included} agents. Chaque agent en plus coûte{' '}
                  {formatMoney(d.plan.extraAgentPrice, d.currency)} par mois.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-center gap-3 py-2">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Retirer un agent"
                  disabled={extra <= 0}
                  onClick={() => setExtra(extra - 1)}
                >
                  <Minus aria-hidden />
                </Button>
                <Input
                  type="number"
                  min={0}
                  max={1000}
                  aria-label="Nombre d’agents supplémentaires"
                  className="w-24 text-center text-lg tabular-nums"
                  value={extra}
                  onChange={(e) => setExtra(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))}
                />
                <Button variant="outline" size="icon" aria-label="Ajouter un agent" onClick={() => setExtra(extra + 1)}>
                  <Plus aria-hidden />
                </Button>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Soit {d.usage.agents.included + extra} agents actifs autorisés, pour {formatMoney(extraTotal, d.currency)} de plus par mois.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setExtra(null)}>
                  Annuler
                </Button>
                <Button
                  disabled={change.isPending || extra === d.usage.agents.extra}
                  onClick={() => change.mutate({ extraAgents: extra }, { onSuccess: () => setExtra(null) })}
                >
                  Enregistrer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!blocking} onOpenChange={(o) => !o && setBlocking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changement impossible pour l’instant</DialogTitle>
            <DialogDescription>Cette formule ne couvre pas des fonctionnalités que vous utilisez. Avant de changer :</DialogDescription>
          </DialogHeader>
          <ul className="list-disc pl-5 text-sm">
            {blocking?.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button onClick={() => setBlocking(null)}>Compris</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

function Quota({ label, used, limit }: { label: string; used: number; limit: number }) {
  const full = used >= limit
  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className={cn('font-medium tabular-nums', full && 'text-status-paused')}>
          {used} / {limit}
        </span>
      </div>
      <Progress
        value={limit ? Math.min(100, (used / limit) * 100) : 0}
        className="mt-1 h-1.5"
        aria-label={`${label} : ${used} sur ${limit}`}
      />
    </div>
  )
}
