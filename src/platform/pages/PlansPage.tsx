import { Feature, PLAN_CODE_PATTERN } from '@suivi/shared'
import { Check, Hourglass, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Page, PageHeader, QueryState } from '@/components/app/page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useApiMutation } from '@/lib/queries'
import { BASE_FEATURES, featureLabel } from '@/lib/subscription'
import { cn } from '@/lib/utils'
import { platformApi } from '../api'
import { formatMoney } from '../labels'
import { usePlans } from '../plans'
import type { Plan, PlanUpdateResult } from '../types'

/** Avantages réglables, dans l'ordre de l'application. */
const FEATURES = Object.values(Feature)

export function PlansPage() {
  const [editing, setEditing] = useState<Plan | 'new' | null>(null)
  const [removing, setRemoving] = useState<Plan | null>(null)
  const query = usePlans()
  return (
    <Page>
      <PageHeader
        title="Formules"
        description="Prix, quotas et avantages du catalogue. Les avantages et les quotas s’appliquent immédiatement à toutes les structures de la formule ; les prix, aux prochaines factures. Les conditions négociées d’une structure priment."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden /> Nouvelle formule
          </Button>
        }
      />
      <QueryState query={query} rows={3}>
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data?.map((plan) => (
            <PlanCard key={plan.code} plan={plan} onEdit={() => setEditing(plan)} onRemove={() => setRemoving(plan)} />
          ))}
        </div>
      </QueryState>
      {editing && <PlanDialog plan={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {removing && <RemoveDialog plan={removing} onClose={() => setRemoving(null)} />}
    </Page>
  )
}

function PlanCard({ plan, onEdit, onRemove }: { plan: Plan; onEdit: () => void; onRemove: () => void }) {
  return (
    <section className={cn('flex flex-col rounded-lg border bg-card', !plan.isActive && 'opacity-70')}>
      <div className="flex items-start justify-between gap-2 border-b p-4">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 font-semibold">
            {plan.name}
            {!plan.isActive && <Badge variant="secondary">Retirée</Badge>}
            {plan.isTrialPlan && (
              <Badge variant="outline" title="L’essai gratuit prend les quotas de cette formule">
                <Hourglass aria-hidden /> Essai
              </Badge>
            )}
            {plan.isDefaultPlan && (
              <Badge variant="outline" title="Attribuée aux nouvelles structures à la fin de l’essai">
                <Sparkles aria-hidden /> Après l’essai
              </Badge>
            )}
          </h2>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{plan.code}</p>
          {plan.description && <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>}
        </div>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon-sm" aria-label={`Modifier la formule ${plan.name}`} onClick={onEdit}>
            <Pencil aria-hidden />
          </Button>
          {!plan.tenants && !plan.isTrialPlan && !plan.isDefaultPlan && (
            <Button variant="ghost" size="icon-sm" aria-label={`Supprimer la formule ${plan.name}`} onClick={onRemove}>
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      </div>
      <div className="p-4">
        <p className="text-2xl font-semibold tabular-nums">
          {formatMoney(plan.monthlyPrice)}
          <span className="text-sm font-normal text-muted-foreground"> / mois</span>
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Agents inclus</dt>
            <dd className="font-medium tabular-nums">{plan.includedAgents}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Chefs d’équipe</dt>
            <dd className="font-medium tabular-nums">{plan.includedLeads}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Agent supplémentaire</dt>
            <dd className="font-medium tabular-nums">{formatMoney(plan.extraAgentPrice)} / mois</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Structures</dt>
            <dd className="font-medium tabular-nums">
              {plan.tenants ?? 0}
              <span className="font-normal text-muted-foreground"> dont {plan.paying ?? 0} payantes</span>
            </dd>
          </div>
        </dl>
      </div>
      <ul className="flex flex-col gap-1.5 border-t p-4 text-sm">
        {BASE_FEATURES.map((label) => (
          <li key={label} className="flex gap-2 text-muted-foreground">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
            {label}
          </li>
        ))}
        {FEATURES.map((f) => {
          const included = plan.features.includes(f)
          return (
            <li key={f} className={cn('flex gap-2', !included && 'text-muted-foreground/60 line-through')}>
              {included ? (
                <Check className="mt-0.5 size-4 shrink-0 text-status-active" aria-hidden />
              ) : (
                <X className="mt-0.5 size-4 shrink-0" aria-hidden />
              )}
              <span>
                {featureLabel[f]}
                <span className="sr-only">{included ? ' : inclus' : ' : non inclus'}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Création ou modification : identité, prix, quotas, avantages. */
function PlanDialog({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const [v, setV] = useState({
    code: plan?.code ?? '',
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    monthlyPrice: plan ? String(plan.monthlyPrice) : '',
    includedAgents: plan ? String(plan.includedAgents) : '',
    includedLeads: plan ? String(plan.includedLeads) : '',
    extraAgentPrice: plan ? String(plan.extraAgentPrice) : '',
    isActive: plan?.isActive ?? true,
    features: plan?.features ?? ([] as Feature[]),
  })
  const number = (key: 'monthlyPrice' | 'includedAgents' | 'includedLeads' | 'extraAgentPrice') => ({
    inputMode: 'numeric' as const,
    value: v[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [key]: e.target.value.replace(/\D/g, '') }),
  })
  const toggle = (feature: Feature, on: boolean) =>
    setV({ ...v, features: on ? [...v.features, feature] : v.features.filter((f) => f !== feature) })
  const body = {
    name: v.name.trim(),
    description: v.description.trim(),
    monthlyPrice: Number(v.monthlyPrice),
    includedAgents: Number(v.includedAgents),
    includedLeads: Number(v.includedLeads),
    extraAgentPrice: Number(v.extraAgentPrice),
    isActive: v.isActive,
    // Ordre de l'application, quel que soit l'ordre des clics.
    features: FEATURES.filter((f) => v.features.includes(f)),
  }
  const save = useApiMutation(
    async () =>
      plan
        ? (await platformApi.patch<PlanUpdateResult>(`/plans/${plan.code}`, body)).data
        : (await platformApi.post<Plan>('/plans', { ...body, code: v.code.trim() }), null),
    {
      success: plan ? 'Formule mise à jour' : 'Formule créée : elle est proposée aux structures',
      invalidate: [['platform']],
      onSuccess: (result) => {
        for (const warning of result?.warnings ?? []) toast.warning(warning)
        onClose()
      },
    },
  )
  const removed = plan ? plan.features.filter((f) => !v.features.includes(f)) : []
  const affected = plan ? (plan.tenants ?? 0) : 0
  const codeValid = !!plan || PLAN_CODE_PATTERN.test(v.code.trim())
  const valid = codeValid && v.name.trim() && [v.monthlyPrice, v.includedAgents, v.includedLeads, v.extraAgentPrice].every((x) => x !== '')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{plan ? `Formule ${plan.name}` : 'Nouvelle formule'}</DialogTitle>
          <DialogDescription>
            {plan
              ? `${affected} structure${affected > 1 ? 's' : ''} sur cette formule : les avantages et les quotas changent pour elles dès l’enregistrement.`
              : 'Proposée aux structures dans leur page Abonnement dès sa création, sauf si vous la retirez du catalogue.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-name">Nom</Label>
            <Input id="plan-name" value={v.name} maxLength={60} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-code">Code</Label>
            <Input
              id="plan-code"
              value={v.code}
              disabled={!!plan}
              aria-invalid={!codeValid && v.code !== ''}
              placeholder="ex. entreprise-plus"
              onChange={(e) => setV({ ...v, code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
            />
            <p className="text-xs text-muted-foreground">
              {plan ? 'Définitif : il identifie la formule sur les factures.' : 'Minuscules, chiffres et tirets. Définitif.'}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="plan-description">Description (visible par les structures)</Label>
            <Textarea
              id="plan-description"
              rows={2}
              maxLength={300}
              value={v.description}
              onChange={(e) => setV({ ...v, description: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-price">Forfait mensuel (FCFA)</Label>
            <Input id="plan-price" {...number('monthlyPrice')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-extra">Prix d’un agent supplémentaire</Label>
            <Input id="plan-extra" {...number('extraAgentPrice')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-agents">Agents inclus</Label>
            <Input id="plan-agents" {...number('includedAgents')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-leads">Chefs d’équipe inclus</Label>
            <Input id="plan-leads" {...number('includedLeads')} />
          </div>
        </div>

        <fieldset className="rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">Avantages inclus</legend>
          <p className="mb-2 text-xs text-muted-foreground">Toujours inclus : {BASE_FEATURES.join(', ').toLowerCase()}.</p>
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <label key={f} className="flex items-start gap-2 text-sm">
                <Checkbox className="mt-0.5" checked={v.features.includes(f)} onCheckedChange={(on) => toggle(f, on === true)} />
                {featureLabel[f]}
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setV({ ...v, features: [...FEATURES] })}>
              Tout cocher
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setV({ ...v, features: [] })}>
              Tout décocher
            </Button>
          </div>
        </fieldset>
        {removed.length > 0 && affected > 0 && (
          <p role="alert" className="rounded-md border border-status-paused/30 bg-status-paused/5 p-3 text-sm">
            Les structures de cette formule (hors essai) perdront aussitôt : {removed.map((f) => featureLabel[f].toLowerCase()).join(', ')}.
          </p>
        )}

        <label className="flex items-center gap-2 text-sm">
          <Switch checked={v.isActive} onCheckedChange={(x) => setV({ ...v, isActive: x })} />
          Proposée aux structures (retirée : invisible pour les nouvelles, les clientes actuelles la gardent)
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate(undefined)}>
            {plan ? 'Enregistrer' : 'Créer la formule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RemoveDialog({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const remove = useApiMutation(() => platformApi.delete(`/plans/${plan.code}`), {
    success: 'Formule supprimée',
    invalidate: [['platform']],
    onSuccess: onClose,
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer la formule {plan.name} ?</DialogTitle>
          <DialogDescription>Aucune structure ne l’utilise. La suppression est définitive.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(undefined)}>
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
