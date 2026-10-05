import type { SubscriptionStatus } from '@suivi/shared'
import { useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Ban, CircleCheck, FileText, ShieldAlert } from 'lucide-react'
import { StatusPill } from '@/components/app/status'
import { formatNumber } from '@/lib/format'
import { shortMonth, statusTone, subscriptionStatusLabel } from './labels'
import type { Invoice } from './types'

/** Statut d'abonnement d'une structure ; « suspendue par l'éditeur » se distingue d'un impayé. */
export function TenantStatus({ status, manual }: { status: SubscriptionStatus | null; manual?: boolean | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>
  const [tone, icon] = statusTone[status]
  return <StatusPill tone={tone} icon={icon} label={manual ? 'Suspendue (éditeur)' : subscriptionStatusLabel[status]} />
}

/** Ligne libellé / valeur des fiches. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}

/** Couleurs validées (contraste et daltonisme) pour deux séries côte à côte. */
const SERIES = { invoiced: '#2563eb', paid: '#0d9488' }

/** Facturé et encaissé par mois : deux barres par mois, une seule échelle. */
export function RevenueChart({ data, currency }: { data: { month: string; invoiced: number; paid: number }[]; currency: string }) {
  const money = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
  return (
    <div style={{ height: 280 }} role="img" aria-label="Graphique : facturé et encaissé sur 12 mois">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data.map((d) => ({ ...d, label: shortMonth(d.month) }))}
          margin={{ top: 4, right: 4, bottom: 0, left: 8 }}
          barGap={2}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke="var(--muted-foreground)"
            tickFormatter={(v: number) => (v >= 1000 ? `${formatNumber(v / 1000)} k` : String(v))}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
            contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
            formatter={(value, name) => [money(Number(value)), name]}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="invoiced" name="Facturé" fill={SERIES.invoiced} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="paid" name="Encaissé" fill={SERIES.paid} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Payée, annulée, échue ou à payer. */
export function InvoiceStatusPill({ invoice }: { invoice: Invoice }) {
  const [now] = useState(Date.now)
  if (invoice.status === 'paid') return <StatusPill tone="active" icon={CircleCheck} label="Payée" />
  if (invoice.status === 'void') return <StatusPill tone="ended" icon={Ban} label="Annulée" />
  return Date.parse(invoice.dueAt) < now ? (
    <StatusPill tone="alert" icon={ShieldAlert} label="Échue" />
  ) : (
    <StatusPill tone="paused" icon={FileText} label="À payer" />
  )
}
