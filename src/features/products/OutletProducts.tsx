import { Feature } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { useFeature } from '@/lib/subscription'
import { formatPrice, formatQuantity, productName, type Product } from './products'

interface OutletProduct extends Pick<Product, 'name' | 'format' | 'own' | 'unit' | 'packagings'> {
  productId: string
  last: {
    at: string
    presence: boolean | null
    stock: number | null
    price: number | null
    sold: number | null
    losses: number | null
  }
  stockHistory: { at: string; stock: number }[]
}

/** Courbe minimale de l'évolution du stock (derniers relevés). */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const w = 72
  const h = 22
  const max = Math.max(...points, 1)
  const step = w / (points.length - 1)
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(h - (v / max) * (h - 2) - 1).toFixed(1)}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Évolution du stock : ${points.join(', ')}`}>
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Fiche d'un point de vente : le dernier relevé de chaque produit et l'évolution du stock. */
export function OutletProducts({ outletId }: { outletId: string }) {
  const enabled = useFeature(Feature.ProductAudits)
  const query = useQuery({
    queryKey: ['insights', 'outlet', outletId],
    enabled,
    queryFn: async () => (await api.get<OutletProduct[]>(`/insights/products/outlets/${outletId}`)).data,
  })
  if (!enabled || !query.data?.length) return null
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Produits relevés</h3>
      <ul className="flex flex-col divide-y rounded-lg border">
        {query.data.map((p) => (
          <li key={p.productId} className="flex items-center gap-3 px-3 py-2 text-sm">
            {p.last.presence === null ? (
              <span className="size-4" />
            ) : p.last.presence ? (
              <Check className="size-4 shrink-0 text-status-active" aria-label="Présent" />
            ) : (
              <X className="size-4 shrink-0 text-status-alert" aria-label="Rupture" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {productName(p)}
                {!p.own && <span className="ml-1 text-xs font-normal text-status-paused">concurrent</span>}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {[
                  p.last.presence === false ? 'Rupture' : null,
                  p.last.stock !== null ? `Stock ${formatQuantity(p.last.stock, p)}` : null,
                  p.last.price !== null ? formatPrice(p.last.price) : null,
                  formatDateTime(p.last.at),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <Sparkline points={p.stockHistory.map((h) => h.stock)} />
          </li>
        ))}
      </ul>
    </section>
  )
}
