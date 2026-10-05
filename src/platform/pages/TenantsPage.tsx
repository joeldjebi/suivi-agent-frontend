import { SubscriptionStatus } from '@suivi/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Building2, Plus, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { SearchInput } from '@/components/app/search-input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatPhone, formatRelative } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { platformApi } from '../api'
import { TenantStatus } from '../components'
import { to } from '../config'
import { formatMoney, subscriptionStatusLabel } from '../labels'
import { usePlanName, usePlans } from '../plans'
import type { Paged, TenantDetail, TenantRow } from '../types'

const ALL = 'all'
const PAGE_SIZE = 25
const SORTS = {
  created: 'Plus récentes',
  name: 'Nom',
  mrr: 'Revenu mensuel',
  agents: 'Agents actifs',
  activity: 'Dernière activité',
} as const
type Sort = keyof typeof SORTS

export function TenantsPage() {
  const plans = usePlans()
  const planName = usePlanName()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>(ALL)
  const [plan, setPlan] = useState<string>(ALL)
  const [overdue, setOverdue] = useState(false)
  const [sort, setSort] = useState<Sort>('created')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const filtered = search !== '' || status !== ALL || plan !== ALL || overdue
  const reset = () => {
    setSearchInput('')
    setSearch('')
    setStatus(ALL)
    setPlan(ALL)
    setOverdue(false)
    setPage(1)
  }

  const query = useQuery({
    queryKey: ['platform', 'tenants', { search, status, plan, overdue, sort, page }],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await platformApi.get<Paged<TenantRow>>('/tenants', {
          params: {
            search: search || undefined,
            status: status === ALL ? undefined : status,
            planCode: plan === ALL ? undefined : plan,
            overdue: overdue || undefined,
            sort,
            page,
            limit: PAGE_SIZE,
          },
        })
      ).data,
  })
  const data = query.data

  return (
    <Page>
      <PageHeader
        title="Structures"
        description="Toutes les structures clientes, leur abonnement et leur activité."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden /> Nouvelle structure
          </Button>
        }
      />

      <div className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto]">
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          label="Rechercher une structure"
          placeholder="Nom, email ou numéro de l’administrateur"
          className="sm:col-span-2 lg:col-span-1"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v ?? ALL)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full" aria-label="Statut">
            <SelectValue>{(v: string) => (v === ALL ? 'Tous les statuts' : subscriptionStatusLabel[v as SubscriptionStatus])}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les statuts</SelectItem>
            {Object.values(SubscriptionStatus)
              .filter((s) => s !== SubscriptionStatus.Cancelled)
              .map((s) => (
                <SelectItem key={s} value={s}>
                  {subscriptionStatusLabel[s]}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select
          value={plan}
          onValueChange={(v) => {
            setPlan(v ?? ALL)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full" aria-label="Formule">
            <SelectValue>{(v: string) => (v === ALL ? 'Toutes les formules' : planName(v))}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toutes les formules</SelectItem>
            {plans.data?.map((p) => (
              <SelectItem key={p.code} value={p.code}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => v && setSort(v as Sort)}>
          <SelectTrigger className="w-full" aria-label="Tri">
            <SelectValue>{(v: Sort) => `Tri : ${SORTS[v]}`}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORTS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex h-9 items-center gap-2 text-sm whitespace-nowrap">
          <Switch
            checked={overdue}
            onCheckedChange={(v) => {
              setOverdue(v)
              setPage(1)
            }}
          />
          Impayés seulement
        </label>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {data ? `${data.total} structure${data.total > 1 ? 's' : ''}` : ' '}
          {filtered && ' (filtrées)'}
        </span>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <X aria-hidden /> Effacer les filtres
          </Button>
        )}
      </div>

      <QueryState query={query} rows={8}>
        {data && data.items.length === 0 ? (
          <EmptyState icon={Building2} title="Aucune structure" description="Aucune structure ne correspond à ces critères." />
        ) : (
          data && (
            <div className={cn('overflow-x-auto rounded-lg border bg-card', query.isFetching && 'opacity-70')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Structure</TableHead>
                    <TableHead>Abonnement</TableHead>
                    <TableHead className="text-right">Agents</TableHead>
                    <TableHead className="text-right">Revenu / mois</TableHead>
                    <TableHead>Dernière activité</TableHead>
                    <TableHead className="text-right">Impayé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((t) => (
                    <TableRow key={t.id} className="relative">
                      <TableCell>
                        <Link to={to(`/tenants/${t.id}`)} className="font-medium after:absolute after:inset-0 hover:underline">
                          {t.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {t.adminEmail ?? '—'}
                          {t.adminPhone && ` · ${formatPhone(t.adminPhone)}`}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <TenantStatus status={t.status} manual={t.manualSuspension} />
                          {t.planCode && (
                            <span className="text-sm">
                              {t.planName ?? planName(t.planCode)}
                              {t.billingCycle === 'annual' && <span className="text-muted-foreground"> · annuel</span>}
                            </span>
                          )}
                          {t.customTerms && (
                            <span className="inline-flex items-center gap-1 text-xs text-primary" title="Conditions négociées">
                              <Sparkles className="size-3" aria-hidden /> négocié
                            </span>
                          )}
                        </div>
                        {t.status === 'trialing' && t.trialEndsAt && (
                          <p className="mt-0.5 text-xs text-muted-foreground">Fin d’essai {formatRelative(t.trialEndsAt)}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={cn(t.agentLimit !== null && t.agents > t.agentLimit && 'font-semibold text-status-alert')}>
                          {t.agents}
                        </span>
                        <span className="text-muted-foreground"> / {t.agentLimit ?? '—'}</span>
                        <p className="text-xs text-muted-foreground">
                          {t.leads} chef{t.leads > 1 ? 's' : ''}
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{t.mrr ? formatMoney(t.mrr) : '—'}</TableCell>
                      <TableCell className="text-sm">
                        {t.lastActivity ? formatRelative(t.lastActivity) : <span className="text-muted-foreground">Jamais</span>}
                        <p className="text-xs text-muted-foreground">Client depuis le {formatDate(t.createdAt)}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {t.overdueAmount ? (
                          <span className="font-semibold text-status-alert">{formatMoney(t.overdueAmount)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        )}
      </QueryState>
      {data && (
        <Pagination
          page={data.page}
          pages={Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
          total={data.total}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      )}
      <CreateTenantDialog open={creating} onClose={() => setCreating(false)} />
    </Page>
  )
}

const TRIAL = 'trial'

function CreateTenantDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const plans = usePlans()
  const planName = usePlanName()
  const navigate = useNavigate()
  const empty = { organizationName: '', firstName: '', lastName: '', email: '', password: '', contactPhone: '' }
  const [values, setValues] = useState(empty)
  const [plan, setPlan] = useState<string>(TRIAL)
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly')
  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: e.target.value }))
  const close = () => {
    setValues(empty)
    setPlan(TRIAL)
    setCycle('monthly')
    onClose()
  }
  const create = useApiMutation(
    async () =>
      (
        await platformApi.post<TenantDetail>('/tenants', {
          ...values,
          contactPhone: values.contactPhone.trim() || undefined,
          planCode: plan === TRIAL ? undefined : plan,
          billingCycle: plan === TRIAL ? undefined : cycle,
        })
      ).data,
    {
      success: 'Structure créée : transmettez ses identifiants à l’administrateur',
      invalidate: [['platform']],
      onSuccess: (detail) => {
        close()
        navigate(to(`/tenants/${detail.tenant.id}`))
      },
    },
  )
  const valid =
    values.organizationName.trim() &&
    values.firstName.trim() &&
    values.lastName.trim() &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email.trim()) &&
    values.password.length >= 8
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle structure</DialogTitle>
          <DialogDescription>
            Crée l’espace de la structure et son administrateur. Il se connectera avec cet email et le mot de passe provisoire.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="t-name">Nom de la structure</Label>
            <Input id="t-name" value={values.organizationName} onChange={set('organizationName')} maxLength={120} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-first">Prénom de l’administrateur</Label>
            <Input id="t-first" value={values.firstName} onChange={set('firstName')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-last">Nom</Label>
            <Input id="t-last" value={values.lastName} onChange={set('lastName')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-email">Email</Label>
            <Input id="t-email" type="email" value={values.email} onChange={set('email')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-phone">Téléphone de contact (facultatif)</Label>
            <Input id="t-phone" inputMode="tel" value={values.contactPhone} onChange={set('contactPhone')} placeholder="07 07 07 07 07" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="t-password">Mot de passe provisoire (8 caractères minimum)</Label>
            <Input id="t-password" type="text" autoComplete="off" value={values.password} onChange={set('password')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Démarrage</Label>
            <Select value={plan} onValueChange={(v) => v && setPlan(v)}>
              <SelectTrigger className="w-full" aria-label="Démarrage">
                <SelectValue>{(v: string) => (v === TRIAL ? 'Essai gratuit' : `Formule ${planName(v)}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TRIAL}>Essai gratuit</SelectItem>
                {plans.data
                  ?.filter((p) => p.isActive)
                  .map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      Formule {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Facturation</Label>
            <Select value={cycle} disabled={plan === TRIAL} onValueChange={(v) => v && setCycle(v as 'monthly' | 'annual')}>
              <SelectTrigger className="w-full" aria-label="Facturation">
                <SelectValue>{(v: string) => (v === 'annual' ? 'Engagement annuel' : 'Mensuelle')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensuelle</SelectItem>
                <SelectItem value="annual">Engagement annuel</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Annuler
          </Button>
          <Button disabled={!valid || create.isPending} onClick={() => create.mutate(undefined)}>
            Créer la structure
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
