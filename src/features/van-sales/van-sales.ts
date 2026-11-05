import type { Packaging, PaymentMethod, StockLocationKind, StockMovementKind, StockMovementStatus } from '@suivi/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** Dépôt ou camion. */
export interface StockLocation {
  id: string
  kind: StockLocationKind
  name: string
  plate: string | null
  agentId: string | null
  agentName: string | null
  isActive: boolean
}

export interface StockLevels {
  locations: StockLocation[]
  products: {
    id: string
    name: string
    format: string | null
    category: string | null
    unit: string
    packagings: Packaging[]
    /** Quantité par emplacement (unités de base) */
    quantities: Record<string, number>
    total: number
  }[]
}

export interface StockMovement {
  id: string
  kind: StockMovementKind
  label: string
  status: StockMovementStatus
  fromLocationId: string | null
  fromName: string | null
  toLocationId: string | null
  toName: string | null
  orderId: string | null
  note: string | null
  createdBy: string | null
  createdByName: string | null
  confirmedByName: string | null
  confirmedAt: string | null
  occurredAt: string
  lines: {
    productId: string
    name: string
    unit: string
    packagings: Packaging[]
    quantity: number
    /** Quantité reçue à la confirmation */
    received: number | null
  }[]
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface CashRow {
  agentId: string
  agentName: string
  vanName: string | null
  salesCount: number
  salesAmount: number
  /** Reste dû sur les ventes du jour */
  dueOnSales: number
  cash: number
  mobileMoney: number
  bank: number
  remittedToday: number
  /** Argent liquide encore entre les mains de l'agent */
  cashBalance: number
}

export interface CashDay {
  day: string
  agents: CashRow[]
  remittances: { id: string; agentId: string; amount: number; note: string | null; remittedAt: string; receivedBy: string | null }[]
  totals: Omit<CashRow, 'agentId' | 'agentName' | 'vanName'>
}

export interface OutletBalance {
  outletId: string
  outletName: string
  /** Plafond de crédit ; null : pas de vente à crédit */
  creditLimit: number | null
  outstanding: number
  advance: number
  available: number
  dues: { id: string; reference: string; total: number; paidAmount: number; due: number; takenAt: string }[]
}

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'mobile_money', 'bank']

export function useLocations(enabled = true) {
  return useQuery({
    queryKey: ['stock', 'locations'],
    enabled,
    queryFn: async () => (await api.get<StockLocation[]>('/stock/locations')).data,
  })
}

export function useStockLevels(locationId?: string) {
  return useQuery({
    queryKey: ['stock', 'levels', locationId ?? 'all'],
    queryFn: async () => (await api.get<StockLevels>('/stock/levels', { params: { locationId } })).data,
  })
}

export interface MovementsParams {
  locationId?: string
  productId?: string
  kind?: StockMovementKind
  status?: StockMovementStatus
  from?: string
  to?: string
  page?: number
  limit?: number
}

export function useMovements(params: MovementsParams) {
  return useQuery({
    queryKey: ['stock', 'movements', params],
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get<Page<StockMovement>>('/stock/movements', { params })).data,
  })
}

export function useCash(params: { date?: string; agentId?: string }) {
  return useQuery({
    queryKey: ['van-sales', 'cash', params],
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get<CashDay>('/van-sales/cash', { params })).data,
  })
}

export function useOutletBalance(outletId: string, enabled = true) {
  return useQuery({
    queryKey: ['van-sales', 'balance', outletId],
    enabled,
    queryFn: async () => (await api.get<OutletBalance>(`/van-sales/outlets/${outletId}/balance`)).data,
  })
}

/** Télécharge le reçu PDF d'une vente ou d'une commande (fiable même après l'attente réseau). */
export async function downloadReceipt(orderId: string, reference: string) {
  const res = await api.get<Blob>(`/van-sales/orders/${orderId}/receipt`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const link = document.createElement('a')
  link.href = url
  link.download = `recu-${reference}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
