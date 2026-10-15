import type { Packaging } from '@suivi/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { PeriodPicker } from '@/components/app/period-picker'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { usePeriod } from '@/lib/period'
import { formatMoney } from '@/lib/subscription'
import { formatQuantity, productName } from '../products/products'

interface FormUsage {
  id: string
  name: string
  submissions: number
  outlets: number
}

type FieldStats =
  | { kind: 'number'; answered: number; sum: number; avg: number | null; min: number | null; max: number | null }
  | { kind: 'boolean'; answered: number; yes: number; no: number; yesRate: number | null }
  | { kind: 'select'; answered: number; options: { value: string; count: number }[] }
  | { kind: 'photo'; answered: number }
  | { kind: 'products'; answered: number; products: ProductStats[] }
  | { kind: 'text'; answered: number }

interface ProductStats {
  productId: string
  name: string
  format: string | null
  own: boolean
  unit: string
  packagings: Packaging[]
  checked: number
  stockouts: number
  avgStock: number | null
  avgPrice: number | null
  sold: number
}

interface FormStats {
  form: { id: string; name: string }
  submissions: number
  outlets: number
  fields: { key: string; label: string; type: string; stats: FieldStats }[]
}

/**
 * Les formulaires créés par la structure, en chiffres : pour le formulaire choisi, chaque champ
 * est résumé selon son type (total d'un nombre, part de « Oui », répartition d'une liste,
 * photos prises, relevé produit par produit). Administrateur : toute la structure ; chef : son
 * équipe. Formulaires acceptés seulement.
 */
export function FormStatsPage() {
  const period = usePeriod()
  const range = { from: period.from, to: period.to }
  const forms = useQuery({
    queryKey: ['form-stats', range],
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get<{ forms: FormUsage[] }>('/form-stats', { params: range })).data.forms,
  })
  const [chosen, setChosen] = useState<string | null>(null)
  const selected = forms.data?.find((f) => f.id === chosen) ?? forms.data?.[0]
  const stats = useQuery({
    queryKey: ['form-stats', selected?.id, range],
    enabled: !!selected,
    queryFn: async () => (await api.get<FormStats>(`/form-stats/${selected!.id}`, { params: range })).data,
  })

  return (
    <Page>
      <PageHeader
        title="Réponses aux formulaires"
        description="Chaque champ de vos formulaires résumé selon son type : totaux et moyennes, part de « Oui », répartition des choix, photos, relevés produits. Formulaires acceptés seulement."
      />
      <div className="flex flex-wrap items-end gap-3">
        <PeriodPicker period={period} />
        {!!forms.data?.length && (
          <div className="flex flex-col gap-1.5">
            <Label>Formulaire</Label>
            <Select value={selected?.id ?? ''} onValueChange={(v) => v && setChosen(v)}>
              <SelectTrigger className="w-72" aria-label="Formulaire">
                <SelectValue>{(v: string) => forms.data?.find((f) => f.id === v)?.name ?? 'Formulaire'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {forms.data.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} ({f.submissions})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <QueryState query={forms}>
        {!forms.data?.length ? (
          <EmptyState
            icon={ClipboardList}
            title="Aucun formulaire envoyé sur la période"
            description="Les chiffres apparaissent dès que vos agents remplissent des formulaires, en mission ou en visite."
          />
        ) : (
          <QueryState query={stats}>
            {stats.data && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  {stats.data.submissions} formulaire{stats.data.submissions > 1 ? 's' : ''}
                  {stats.data.outlets > 0 && ` · ${stats.data.outlets} point${stats.data.outlets > 1 ? 's' : ''} de vente`}
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {stats.data.fields.map((f) => (
                    <FieldCard key={f.key} label={f.label} stats={f.stats} total={stats.data.submissions} />
                  ))}
                </div>
              </div>
            )}
          </QueryState>
        )}
      </QueryState>
    </Page>
  )
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

/** Un champ du formulaire, résumé selon son type. */
function FieldCard({ label, stats: s, total }: { label: string; stats: FieldStats; total: number }) {
  const replies = `${s.answered} réponse${s.answered > 1 ? 's' : ''} sur ${total}`
  return (
    <section
      className={`flex flex-col gap-2 rounded-lg border bg-card p-4 ${s.kind === 'products' ? 'md:col-span-2' : ''}`}
      aria-label={label}
    >
      <h2 className="font-medium">{label}</h2>
      {s.kind === 'number' && (
        <>
          <p className="text-2xl font-semibold tabular-nums">{formatNumber(s.sum)}</p>
          <p className="text-xs text-muted-foreground">
            {s.avg === null
              ? replies
              : `moyenne ${formatNumber(s.avg)} · de ${formatNumber(s.min ?? 0)} à ${formatNumber(s.max ?? 0)} · ${replies}`}
          </p>
        </>
      )}
      {s.kind === 'boolean' && (
        <>
          <p className="text-2xl font-semibold tabular-nums">{s.yesRate === null ? '—' : `${s.yesRate} % de Oui`}</p>
          {s.yesRate !== null && <Bar value={s.yesRate} />}
          <p className="text-xs text-muted-foreground">
            Oui {s.yes} · Non {s.no}
          </p>
        </>
      )}
      {s.kind === 'select' && (
        <>
          <ul className="flex flex-col gap-2">
            {s.options.map((o) => {
              const pct = s.answered ? Math.round((o.count * 100) / s.answered) : 0
              return (
                <li key={o.value} className="flex flex-col gap-1 text-sm">
                  <span className="flex justify-between gap-2">
                    <span>{o.value}</span>
                    <span className="tabular-nums">
                      {o.count} · {pct} %
                    </span>
                  </span>
                  <Bar value={pct} />
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-muted-foreground">{replies}</p>
        </>
      )}
      {s.kind === 'photo' && (
        <>
          <p className="text-2xl font-semibold tabular-nums">
            {s.answered} photo{s.answered > 1 ? 's' : ''}
          </p>
          <p className="text-xs text-muted-foreground">
            prises sur {total} formulaire{total > 1 ? 's' : ''}
          </p>
        </>
      )}
      {s.kind === 'products' &&
        (s.products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun produit relevé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3 font-medium">Produit</th>
                  <th className="py-1 pr-3 font-medium">Ruptures</th>
                  <th className="py-1 pr-3 font-medium">Stock moyen</th>
                  <th className="py-1 pr-3 font-medium">Prix moyen</th>
                  <th className="py-1 font-medium">Vendu</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {s.products.map((p) => (
                  <tr key={p.productId}>
                    <td className="py-1.5 pr-3">
                      {productName(p)}
                      {!p.own && <span className="ml-1.5 text-xs text-status-paused">concurrent</span>}
                    </td>
                    <td className={`py-1.5 pr-3 tabular-nums ${p.stockouts ? 'text-status-alert' : ''}`}>
                      {p.checked ? `${p.stockouts}/${p.checked}` : '—'}
                    </td>
                    <td className="py-1.5 pr-3">{p.avgStock === null ? '—' : formatQuantity(p.avgStock, p)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{p.avgPrice === null ? '—' : formatMoney(p.avgPrice)}</td>
                    <td className="py-1.5">{p.sold ? formatQuantity(p.sold, p) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      {s.kind === 'text' && (
        <p className="text-sm text-muted-foreground">{replies} · réponses libres, à lire dans les formulaires reçus.</p>
      )}
    </section>
  )
}
