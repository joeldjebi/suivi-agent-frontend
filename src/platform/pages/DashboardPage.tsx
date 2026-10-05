import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Banknote, Building2, Hourglass, TrendingUp, UserPlus, Users } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Card, Chart, Kpi } from '@/features/stats/components'
import { formatDate, formatNumber, formatRelative } from '@/lib/format'
import { platformApi } from '../api'
import { RevenueChart, TenantStatus } from '../components'
import { to } from '../config'
import { formatMoney, monthLabel, shortMonth } from '../labels'
import { usePlanName } from '../plans'
import type { Dashboard } from '../types'

export function DashboardPage() {
  const query = useQuery({
    queryKey: ['platform', 'dashboard'],
    queryFn: async () => (await platformApi.get<Dashboard>('/dashboard')).data,
    refetchInterval: 60_000,
  })
  const d = query.data
  return (
    <Page>
      <PageHeader
        title="Tableau de bord"
        description={d ? `Activité de la plateforme · ${monthLabel(d.months.at(-1)?.month ?? '')}` : 'Activité de la plateforme'}
      />
      <QueryState query={query} rows={6}>
        {d && <Content d={d} />}
      </QueryState>
    </Page>
  )
}

function Content({ d }: { d: Dashboard }) {
  const planName = usePlanName()
  const money = (v: number) => formatMoney(v, d.currency)
  const paying = d.tenants.active + d.tenants.pastDue
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={TrendingUp} label="Revenu mensuel récurrent" value={money(d.mrr)} hint={`${money(d.arr)} sur un an`} />
        <Kpi
          icon={Building2}
          label="Structures clientes"
          value={formatNumber(paying)}
          hint={`${d.tenants.trialing} en essai · ${d.tenants.suspended} suspendue${d.tenants.suspended > 1 ? 's' : ''} · ${d.tenants.total} au total`}
        />
        <Kpi
          icon={Banknote}
          label="Encaissé ce mois-ci"
          value={money(d.invoices.paidThisMonth)}
          delta={[d.invoices.paidThisMonth, d.invoices.paidLastMonth]}
          hint={`${money(d.invoices.pendingAmount)} en attente (${d.invoices.pendingCount} facture${d.invoices.pendingCount > 1 ? 's' : ''})`}
        />
        <Kpi
          icon={AlertTriangle}
          label="Impayés échus"
          value={money(d.invoices.overdueAmount)}
          tone={d.invoices.overdueAmount ? 'text-status-alert' : undefined}
          hint={`${d.invoices.overdueCount} facture${d.invoices.overdueCount > 1 ? 's' : ''} après échéance`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="Facturé et encaissé, 12 derniers mois">
          <RevenueChart data={d.months} currency={d.currency} />
        </Card>
        <Card title="Revenu par formule" flush>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">Formule</th>
                <th className="px-2 py-2 text-right font-medium">Payantes</th>
                <th className="px-4 py-2 text-right font-medium">MRR</th>
              </tr>
            </thead>
            <tbody>
              {d.byPlan.map((p) => (
                <tr key={p.planCode} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{p.name}</p>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${d.mrr ? (p.mrr / d.mrr) * 100 : 0}%` }} />
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {p.paying}
                    <span className="text-muted-foreground"> / {p.tenants}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">{money(p.mrr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid grid-cols-2 gap-3 border-t p-4 text-sm">
            <p>
              <span className="block text-xs text-muted-foreground">Agents actifs</span>
              <span className="font-semibold tabular-nums">{formatNumber(d.usage.agents)}</span>
            </p>
            <p>
              <span className="block text-xs text-muted-foreground">Chefs d’équipe</span>
              <span className="font-semibold tabular-nums">{formatNumber(d.usage.leads)}</span>
            </p>
            <p>
              <span className="block text-xs text-muted-foreground">Structures actives (7 j)</span>
              <span className="font-semibold tabular-nums">{formatNumber(d.usage.activeTenants)}</span>
            </p>
            <p>
              <span className="block text-xs text-muted-foreground">Journées (30 j)</span>
              <span className="font-semibold tabular-nums">{formatNumber(d.usage.daysLast30)}</span>
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Impayés à relancer" flush>
          {d.overdueTenants.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucune facture échue.</p>
          ) : (
            <ul className="divide-y">
              {d.overdueTenants.map((t) => (
                <li key={t.id}>
                  <Link to={to(`/tenants/${t.id}`)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.invoices} facture{t.invoices > 1 ? 's' : ''} · échue {formatRelative(t.oldestDueAt)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-status-alert tabular-nums">{money(t.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Essais qui se terminent" flush>
          {d.trialsEnding.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucun essai ne se termine dans les 7 jours.</p>
          ) : (
            <ul className="divide-y">
              {d.trialsEnding.map((t) => (
                <li key={t.id}>
                  <Link to={to(`/tenants/${t.id}`)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                    <Hourglass className="size-4 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.agents} agent{t.agents > 1 ? 's' : ''} actif{t.agents > 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="text-xs font-medium whitespace-nowrap">{formatRelative(t.trialEndsAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Dernières inscriptions" flush>
          {d.recentTenants.length === 0 ? (
            <EmptyState icon={Users} title="Aucune structure" />
          ) : (
            <ul className="divide-y">
              {d.recentTenants.map((t) => (
                <li key={t.id}>
                  <Link to={to(`/tenants/${t.id}`)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                    <UserPlus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(t.createdAt)}
                        {t.planCode && ` · ${planName(t.planCode)}`}
                      </p>
                    </div>
                    <TenantStatus status={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Nouvelles structures par mois">
        <Chart
          data={d.months.map((m) => ({ label: shortMonth(m.month), signups: m.signups }))}
          dataKey="signups"
          name="Inscriptions"
          height={180}
        />
      </Card>
    </>
  )
}
