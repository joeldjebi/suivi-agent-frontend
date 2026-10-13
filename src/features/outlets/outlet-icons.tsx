import type { OutletStatus } from '@suivi/shared'
import L from 'leaflet'
import {
  Beer,
  Fuel,
  Pill,
  ShoppingBasket,
  ShoppingCart,
  Smartphone,
  Store,
  UtensilsCrossed,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OUTLET_STATUS } from './outlets'

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Icône du type de commerce (types proposés, et types saisis qui leur ressemblent). */
const RULES: [RegExp, LucideIcon][] = [
  [/pharma/, Pill],
  [/maquis|bar|cave|buvette/, Beer],
  [/restau|cantine|fast|snack/, UtensilsCrossed],
  [/station|carburant|essence/, Fuel],
  [/grossiste/, Warehouse],
  [/superette|supermarche|alimentation|epicerie/, ShoppingCart],
  [/kiosque|mobile money|cabine/, Smartphone],
  [/marche|etal/, ShoppingBasket],
]

export function categoryIcon(category: string | null | undefined): LucideIcon {
  const text = plain(category ?? '')
  return RULES.find(([re]) => re.test(text))?.[1] ?? Store
}

/** Symbole des statuts « éteints », pour ne pas reposer sur la couleur seule. */
const BADGE: Partial<Record<OutletStatus, string>> = {
  inactive: '<path d="M9 8v8M15 8v8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  closed: '<path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
}

const cache = new Map<string, L.DivIcon>()

/**
 * Marqueur de point de vente : épingle à la couleur du statut, icône du type de commerce,
 * pastille ‖ (inactif) ou × (fermé). Les icônes sont mises en cache.
 */
export function outletIcon(category: string | null, status: OutletStatus, focus: boolean): L.DivIcon {
  const Icon = categoryIcon(category)
  const key = `${Icon.displayName ?? category}|${status}|${focus}`
  const cached = cache.get(key)
  if (cached) return cached
  const color = OUTLET_STATUS[status].color
  const size = focus ? 40 : 32
  const glyph = renderToStaticMarkup(<Icon size={size * 0.42} color="#fff" strokeWidth={2.25} aria-hidden />)
  const badge = BADGE[status]
  const icon = L.divIcon({
    className: 'outlet-marker',
    iconSize: [size, size * 1.25],
    iconAnchor: [size / 2, size * 1.25],
    tooltipAnchor: [0, -size],
    html: `<div style="position:relative;width:${size}px;height:${size * 1.25}px;filter:drop-shadow(0 1px 2px rgb(0 0 0 / .4))">
      <svg viewBox="0 0 32 40" width="${size}" height="${size * 1.25}" style="position:absolute;inset:0">
        <path d="M16 39c-1-1.6-13-14.2-13-23.5C3 7.9 8.8 2 16 2s13 5.9 13 13.5C29 24.8 17 37.4 16 39z" fill="${color}" stroke="#fff" stroke-width="${focus ? 3 : 2}"/>
      </svg>
      <div style="position:absolute;left:0;right:0;top:${size * 0.2}px;display:flex;justify-content:center">${glyph}</div>
      ${
        badge
          ? `<svg viewBox="0 0 24 24" width="${size * 0.45}" height="${size * 0.45}" style="position:absolute;top:-3px;right:-3px;color:${color}"><circle cx="12" cy="12" r="11" fill="#fff" stroke="${color}" stroke-width="2"/>${badge}</svg>`
          : ''
      }
    </div>`,
  })
  cache.set(key, icon)
  return icon
}
