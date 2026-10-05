import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

export const hours = (s: number) => Math.round((s / 3600) * 10) / 10
export const percent = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0)
export const clock = (minutes: number | null) =>
  minutes === null ? '—' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
export const dayLabel = (date: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))

export function Kpi({
  icon: Icon,
  label,
  value,
  suffix,
  hint,
  delta,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string
  suffix?: string
  hint?: string
  /** [actuel, précédent] */
  delta?: [number, number]
  tone?: string
}) {
  const change = delta && delta[1] ? Math.round(((delta[0] - delta[1]) / delta[1]) * 100) : null
  const DeltaIcon = change === null || change === 0 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {label}
        {delta && (
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-0.5 text-xs font-medium',
              change === null || change === 0 ? 'text-muted-foreground' : change > 0 ? 'text-status-active' : 'text-status-alert',
            )}
            title="Par rapport à la période précédente"
          >
            <DeltaIcon className="size-3.5" aria-hidden />
            {change === null ? 'nouveau' : `${change > 0 ? '+' : ''}${change} %`}
          </span>
        )}
      </p>
      <p className={cn('mt-1 text-3xl font-semibold tabular-nums', tone)}>
        {value}
        {suffix && <span className="ml-1 text-base font-normal text-muted-foreground">{suffix}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function Card({ title, actions, flush, children }: { title: string; actions?: ReactNode; flush?: boolean; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        {actions}
      </div>
      <div className={flush ? 'overflow-x-auto' : 'p-4'}>{children}</div>
    </section>
  )
}

export function Chart<T extends { label: string }>({
  data,
  dataKey,
  name,
  height = 260,
  color = 'var(--primary)',
  onSelect,
}: {
  data: T[]
  dataKey: string
  name: string
  height?: number
  color?: string
  /** Clic sur une barre : son index dans `data`. */
  onSelect?: (index: number) => void
}) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">Aucune donnée sur la période.</p>
  return (
    <div style={{ height }} role="img" aria-label={`Graphique : ${name}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" minTickGap={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
            contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
            formatter={(value) => [formatNumber(Number(value)), name]}
          />
          <Bar
            dataKey={dataKey}
            name={name}
            fill={color}
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
            cursor={onSelect ? 'pointer' : undefined}
            onClick={onSelect ? (_, index) => onSelect(index) : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
