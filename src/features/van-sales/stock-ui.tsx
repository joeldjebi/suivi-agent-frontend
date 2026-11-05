import { STOCK_LOCATION_KIND_LABELS, StockMovementStatus, type Packaging } from '@suivi/shared'
import { CheckCircle2, CircleSlash, Clock, Plus, Trash2, Truck, Warehouse } from 'lucide-react'
import { StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatQuantity, productName, type Product } from '../products/products'
import type { StockLocation, StockMovement } from './van-sales'

/** Ligne saisie : produit, nombre et unité choisie (unité de base ou conditionnement). */
export interface LineDraft {
  key: number
  productId: string
  count: string
  /** BASE : unité de base ; sinon le nom du conditionnement */
  pack: string
}

/** Unité de base (bouteille…) dans le choix de l'unité d'une ligne. */
export const BASE = 'unite'

let nextKey = 0
export const emptyLine = (productId = ''): LineDraft => ({ key: ++nextKey, productId, count: '', pack: BASE })

/** Quantité en unités de base d'une ligne saisie (0 si incomplète). */
export function lineUnits(line: LineDraft, products: Product[]): number {
  const n = Number(line.count.replace(',', '.'))
  if (!(n > 0)) return 0
  const product = products.find((p) => p.id === line.productId)
  const pack = product?.packagings.find((p) => p.name === line.pack)
  return Math.round(n * (pack?.units ?? 1) * 1000) / 1000
}

/** Lignes prêtes à envoyer : produit choisi, quantité positive. */
export function linesBody(lines: LineDraft[], products: Product[]) {
  return lines.map((l) => ({ productId: l.productId, quantity: lineUnits(l, products) })).filter((l) => l.productId && l.quantity > 0)
}

/**
 * Lignes de produits d'un mouvement : produit, quantité, unité (bouteilles ou casiers…),
 * convertie en unités de base et affichée avec sa décomposition.
 */
export function LinesEditor({
  lines,
  onChange,
  products,
  available,
}: {
  lines: LineDraft[]
  onChange: (lines: LineDraft[]) => void
  products: Product[]
  /** Stock disponible par produit, affiché sous la ligne */
  available?: Record<string, number>
}) {
  const update = (key: number, patch: Partial<LineDraft>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  return (
    <div className="flex flex-col gap-2">
      {lines.map((line, i) => {
        const product = products.find((p) => p.id === line.productId)
        const units = lineUnits(line, products)
        const stock = product && available ? (available[product.id] ?? 0) : null
        return (
          <div key={line.key} className="flex flex-col gap-1 rounded-lg border p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={line.productId || null} onValueChange={(v) => update(line.key, { productId: v ?? '', pack: BASE })}>
                <SelectTrigger className="min-w-0 flex-1 basis-48" aria-label={`Produit, ligne ${i + 1}`}>
                  <SelectValue placeholder="Produit">
                    {(v: string) => {
                      const p = products.find((x) => x.id === v)
                      return p ? productName(p) : 'Produit'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {productName(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="w-24"
                inputMode="decimal"
                aria-label={`Quantité, ligne ${i + 1}`}
                placeholder="Qté"
                value={line.count}
                onChange={(e) => update(line.key, { count: e.target.value.replace(/[^\d.,]/g, '') })}
              />
              <Select value={line.pack} onValueChange={(v) => update(line.key, { pack: v ?? BASE })}>
                <SelectTrigger className="w-36" aria-label={`Unité, ligne ${i + 1}`}>
                  <SelectValue>{(v: string) => (v && v !== BASE ? v : (product?.unit ?? 'Unité'))}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BASE}>{product?.unit ?? 'Unité'}</SelectItem>
                  {(product?.packagings ?? []).map((p: Packaging) => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name} ({p.units})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Retirer la ligne ${i + 1}`}
                disabled={lines.length === 1}
                onClick={() => onChange(lines.filter((l) => l.key !== line.key))}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
            {(units > 0 || stock != null) && (
              <p className="text-xs text-muted-foreground">
                {units > 0 && formatQuantity(units, product)}
                {units > 0 && stock != null && ' · '}
                {stock != null && (
                  <span className={units > stock ? 'text-status-alert' : undefined}>Disponible : {formatQuantity(stock, product)}</span>
                )}
              </p>
            )}
          </div>
        )
      })}
      <Button variant="outline" size="sm" className="self-start" onClick={() => onChange([...lines, emptyLine()])}>
        <Plus aria-hidden /> Ajouter un produit
      </Button>
    </div>
  )
}

/** Choix d'un dépôt ou d'un camion actif. */
export function LocationSelect({
  id,
  value,
  onChange,
  locations,
  placeholder = 'Choisir',
}: {
  id?: string
  value: string
  onChange: (id: string) => void
  locations: StockLocation[]
  placeholder?: string
}) {
  return (
    <Select value={value || null} onValueChange={(v) => onChange(v ?? '')}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder}>{(v: string) => locationLabel(locations.find((l) => l.id === v))}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {locations.map((l) => (
          <SelectItem key={l.id} value={l.id}>
            {locationLabel(l)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function locationLabel(l?: StockLocation | null) {
  if (!l) return '…'
  const who = l.kind === 'van' ? (l.agentName ? ` · ${l.agentName}` : ' · sans agent') : ''
  return `${l.name}${l.plate ? ` (${l.plate})` : ''}${who}`
}

export function LocationIcon({ kind, className }: { kind: StockLocation['kind']; className?: string }) {
  const Icon = kind === 'van' ? Truck : Warehouse
  return <Icon className={className ?? 'size-4 shrink-0 text-muted-foreground'} aria-label={STOCK_LOCATION_KIND_LABELS[kind]} />
}

const MOVEMENT_STATUS = {
  [StockMovementStatus.Pending]: { tone: 'paused', icon: Clock, label: 'À confirmer' },
  [StockMovementStatus.Done]: { tone: 'active', icon: CheckCircle2, label: 'Fait' },
  [StockMovementStatus.Cancelled]: { tone: 'ended', icon: CircleSlash, label: 'Annulé' },
} as const

export function MovementStatusPill({ status }: { status: StockMovement['status'] }) {
  const s = MOVEMENT_STATUS[status]
  return <StatusPill tone={s.tone} icon={s.icon} label={s.label} />
}

/** « Dépôt Yopougon → Camion 1 », « Camion 1 → client », « Dépôt Yopougon » (inventaire). */
export function movementRoute(m: StockMovement) {
  if (m.kind === 'sale') return `${m.fromName} → client`
  if (m.kind === 'sale_cancel') return `client → ${m.toName}`
  if (m.kind === 'loss') return `${m.fromName} (sortie)`
  if (m.kind === 'receipt') return `→ ${m.toName}`
  if (m.kind === 'adjustment') return `${m.toName}`
  return `${m.fromName} → ${m.toName}`
}

/** Lignes d'un mouvement : quantités, et écart à la réception s'il y en a un. */
export function MovementLines({ movement }: { movement: StockMovement }) {
  return (
    <ul className="flex flex-col gap-0.5 text-sm">
      {movement.lines.map((l) => {
        const product = { unit: l.unit, packagings: l.packagings }
        const gap = l.received != null && l.received !== l.quantity ? l.received - l.quantity : 0
        const signed = movement.kind === 'adjustment' && l.quantity > 0 ? '+' : ''
        return (
          <li key={l.productId}>
            <span className="font-medium">{l.name}</span> : {signed}
            {formatQuantity(l.quantity, product)}
            {gap !== 0 && (
              <span className="text-status-alert">
                {' '}
                · reçu {formatQuantity(l.received!, product)} (écart {gap > 0 ? '+' : ''}
                {gap.toLocaleString('fr-FR')})
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
