import type { Packaging, ProductMeasure } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Product {
  id: string
  name: string
  brand: string | null
  category: string | null
  format: string | null
  /** Produit de la structure ; false : concurrent */
  own: boolean
  /** Unité de base : bouteille, sachet, kg… */
  unit: string
  packagings: Packaging[]
  isActive: boolean
}

export function useProducts(includeInactive = false) {
  return useQuery({
    queryKey: ['products', { includeInactive }],
    queryFn: async () => (await api.get<Product[]>('/products', { params: { includeInactive: includeInactive || undefined } })).data,
  })
}

/** « Coca-Cola 33 cl » */
export const productName = (p: Pick<Product, 'name' | 'format'>) => (p.format ? `${p.name} ${p.format}` : p.name)

/** Pluriel simple d'une unité ou d'un conditionnement : « bouteille » → « bouteilles ». */
function plural(word: string, n: number) {
  const w = word.toLowerCase()
  if (n <= 1 || /[sxz]$/.test(w) || w === 'kg') return w
  return `${w}s`
}

/**
 * Quantité en unités de base, avec sa décomposition dans le plus grand conditionnement :
 * « 41 bouteilles (3 casiers + 5) ».
 */
export function formatQuantity(units: number, product?: Pick<Product, 'unit' | 'packagings'>) {
  const n = Number(units)
  const unit = product?.unit ?? 'unité'
  const base = `${n.toLocaleString('fr-FR')} ${plural(unit, n)}`
  const pack = [...(product?.packagings ?? [])].sort((a, b) => b.units - a.units).find((p) => p.units <= n)
  if (!pack || !Number.isInteger(n)) return base
  const packs = Math.floor(n / pack.units)
  const rest = n - packs * pack.units
  return `${base} (${packs} ${plural(pack.name, packs)}${rest ? ` + ${rest}` : ''})`
}

export const formatPrice = (v: number) => `${Number(v).toLocaleString('fr-FR')} FCFA`

/** Mesures dans l'ordre d'affichage. */
export const MEASURE_ORDER: ProductMeasure[] = ['presence', 'stock', 'price', 'sold', 'losses', 'ordered']
