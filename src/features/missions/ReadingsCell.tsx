import type { ProductReadings } from '@suivi/shared'
import { Check, X } from 'lucide-react'
import { formatPrice, formatQuantity, MEASURE_ORDER, productName, type Product } from '../products/products'

const LABELS: Record<string, string> = {
  stock: 'Stock',
  sold: 'Vendu',
  losses: 'Pertes',
  ordered: 'Commandé',
}

/** Relevé par produit dans la liste des formulaires : une ligne par produit, quantités en conditionnements. */
export function ReadingsCell({
  value,
  products,
}: {
  value: ProductReadings
  products: Pick<Product, 'id' | 'name' | 'format' | 'unit' | 'packagings'>[]
}) {
  const byId = new Map(products.map((p) => [p.id, p]))
  const order = products.map((p) => p.id)
  const entries = Object.entries(value).sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
  return (
    <ul className="flex min-w-56 flex-col gap-1 text-xs">
      {entries.map(([id, r]) => {
        const product = byId.get(id)
        const parts = MEASURE_ORDER.filter((m) => m !== 'presence' && r[m] !== undefined).map((m) =>
          m === 'price' ? `Prix ${formatPrice(r[m] as number)}` : `${LABELS[m]} ${formatQuantity(r[m] as number, product)}`,
        )
        return (
          <li key={id} className="flex items-start gap-1.5">
            {r.presence !== undefined &&
              (r.presence ? (
                <Check className="mt-0.5 size-3.5 shrink-0 text-status-active" aria-label="Présent" />
              ) : (
                <X className="mt-0.5 size-3.5 shrink-0 text-status-alert" aria-label="Rupture" />
              ))}
            <span>
              <span className="font-medium">{product ? productName(product) : 'Produit retiré'}</span>
              {r.presence === false && <span className="text-status-alert"> · rupture</span>}
              {parts.length > 0 && <span className="text-muted-foreground"> · {parts.join(' · ')}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
