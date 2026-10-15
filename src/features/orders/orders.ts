import { ORDER_STATUS_LABELS, OrderStatus, type Packaging } from '@suivi/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Banknote, CircleSlash, ClipboardList, Truck, type LucideIcon } from 'lucide-react'
import { api } from '@/lib/api'

/** Type de client : sa liste de tarifs (Grossiste, Détaillant…). */
export interface PriceList {
  id: string
  name: string
  isDefault: boolean
  /** Points de vente rattachés */
  outlets: number
}

export interface Order {
  id: string
  /** CMD-000042 */
  reference: string
  outletId: string
  outletName: string
  agentId: string
  agentName: string
  priceListName: string | null
  status: OrderStatus
  total: number
  currency: string
  note: string | null
  /** Distance au point de vente à la prise, en mètres */
  distance: number | null
  takenAt: string
  deliveredAt: string | null
  paidAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  /** Nombre de lignes */
  lines: number
}

export interface OrderDetail extends Omit<Order, 'lines'> {
  lines: {
    productId: string
    name: string
    unit: string
    quantity: number
    unitPrice: number
    amount: number
    packagings: Packaging[] | null
  }[]
  events: { status: OrderStatus; comment: string | null; at: string; user: string | null }[]
}

export interface OrdersSummary {
  currency: string
  count: number
  amount: number
  /** Livrées, pas encore payées */
  toCollect: number
  byStatus: Record<OrderStatus, { count: number; amount: number }>
}

type Tone = 'active' | 'paused' | 'alert' | 'ended' | 'info'

/** Pastille de chaque statut : ton et icône. */
export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone; icon: LucideIcon }> = {
  [OrderStatus.Taken]: { label: ORDER_STATUS_LABELS.taken, tone: 'info', icon: ClipboardList },
  [OrderStatus.Delivered]: { label: ORDER_STATUS_LABELS.delivered, tone: 'paused', icon: Truck },
  [OrderStatus.Paid]: { label: ORDER_STATUS_LABELS.paid, tone: 'active', icon: Banknote },
  [OrderStatus.Cancelled]: { label: ORDER_STATUS_LABELS.cancelled, tone: 'ended', icon: CircleSlash },
}

/** Libellé du bouton qui fait passer une commande à ce statut. */
export const ORDER_ACTION: Record<OrderStatus, string> = {
  taken: 'Prise',
  delivered: 'Marquer livrée',
  paid: 'Marquer payée',
  cancelled: 'Annuler…',
}

export function usePriceLists(enabled = true) {
  return useQuery({
    queryKey: ['orders', 'price-lists'],
    enabled,
    queryFn: async () => (await api.get<PriceList[]>('/orders/price-lists')).data,
  })
}

export interface OrdersParams {
  status?: OrderStatus
  outletId?: string
  agentId?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

export function useOrders(params: OrdersParams, enabled = true) {
  return useQuery({
    queryKey: ['orders', 'list', params],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get<{ items: Order[]; total: number; page: number; limit: number }>('/orders', { params })).data,
  })
}

export function useOrdersSummary(params: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['orders', 'summary', params],
    queryFn: async () => (await api.get<OrdersSummary>('/orders/summary', { params })).data,
  })
}

export function useOrder(id: string | null) {
  return useQuery({
    queryKey: ['orders', 'detail', id],
    enabled: !!id,
    queryFn: async () => (await api.get<OrderDetail>(`/orders/${id}`)).data,
  })
}
