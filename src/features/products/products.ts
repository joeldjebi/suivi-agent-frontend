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
 * Décomposition d'une quantité entière dans les conditionnements, du plus grand au plus petit :
 * 31 bouteilles = 2 casiers (12) + 1 pack (6) + 1. Vide si rien ne s'applique.
 */
export function packBreakdown(units: number, packagings: Pick<Product, 'packagings'>['packagings']) {
  const n = Number(units)
  if (!(n > 0) || !Number.isInteger(n)) return { packs: [], rest: n }
  let left = n
  const packs: { name: string; count: number }[] = []
  for (const p of [...packagings].sort((a, b) => b.units - a.units)) {
    if (p.units <= 1 || left < p.units) continue
    packs.push({ name: p.name, count: Math.floor(left / p.units) })
    left %= p.units
  }
  return { packs, rest: left }
}

/**
 * Quantité en unités de base, avec sa décomposition dans les conditionnements :
 * « 41 bouteilles (3 casiers + 5) », « 30 bouteilles (2 casiers + 1 pack) ».
 */
export function formatQuantity(units: number, product?: Pick<Product, 'unit' | 'packagings'>) {
  const n = Number(units)
  const unit = product?.unit ?? 'unité'
  const base = `${n.toLocaleString('fr-FR')} ${plural(unit, n)}`
  const { packs, rest } = packBreakdown(n, product?.packagings ?? [])
  if (!packs.length) return base
  const parts = [...packs.map((p) => `${p.count} ${plural(p.name, p.count)}`), ...(rest ? [String(rest)] : [])]
  return `${base} (${parts.join(' + ')})`
}

export const formatPrice = (v: number) => `${Number(v).toLocaleString('fr-FR')} FCFA`

/** Mesures dans l'ordre d'affichage. */
export const MEASURE_ORDER: ProductMeasure[] = ['presence', 'stock', 'price', 'sold', 'losses', 'ordered']

const plainText = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Produits du catalogue qui ressemblent à un produit signalé (l'un des noms contient l'autre,
 * sans accents ni majuscules) ; ceux du même format d'abord.
 */
export function similarProducts(s: { name: string; format: string | null }, products: Product[]) {
  const name = plainText(s.name)
  if (!name) return []
  const format = plainText(s.format ?? '').replace(/ /g, '')
  const sameFormat = (p: Product) => (format && plainText(p.format ?? '').replace(/ /g, '') === format ? 1 : 0)
  return products
    .filter((p) => {
      const n = plainText(p.name)
      return p.isActive && !!n && (n.includes(name) || name.includes(n))
    })
    .sort((a, b) => sameFormat(b) - sameFormat(a))
}
