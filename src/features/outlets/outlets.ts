import { type MissionField, OUTLET_STATUS_LABELS, OutletStatus } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, CircleSlash, PauseCircle, Sparkles, Target, type LucideIcon } from 'lucide-react'
import { api } from '@/lib/api'

export interface Outlet {
  id: string
  name: string
  category: string | null
  managerName: string | null
  phone: string | null
  landmark: string | null
  lat: number | null
  lng: number | null
  accuracy: number | null
  status: OutletStatus
  statusChangedAt: string
  photoId: string | null
  data: Record<string, unknown>
  zone: { id: string; name: string } | null
  createdBy: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
  distance?: number
}

export interface OutletHistory {
  id: string
  fromStatus: OutletStatus | null
  toStatus: OutletStatus
  comment: string | null
  createdAt: string
  user: { id: string; name: string } | null
}

export interface OutletVisit {
  id: string
  missionId: string
  missionTitle: string
  agent: string
  submittedAt: string
  /** Distance mesurée entre l'agent et le point de vente, en mètres */
  distance: number | null
  status: 'accepted' | 'rejected'
}

export interface OutletDetail extends Outlet {
  history: OutletHistory[]
  visits: OutletVisit[]
}

export interface OutletPage {
  items: Outlet[]
  total: number
  page: number
  limit: number
  counts: Record<OutletStatus, number>
}

export interface OutletPoint {
  id: string
  name: string
  status: OutletStatus
  category: string | null
  lat: number
  lng: number
}

export interface OutletForm {
  fields: MissionField[]
  categories: string[]
  statuses: { value: OutletStatus; label: string }[]
}

type Tone = 'active' | 'paused' | 'alert' | 'ended' | 'info'

/** Libellé, pastille et couleur sur la carte de chaque statut. */
export const OUTLET_STATUS: Record<OutletStatus, { label: string; tone: Tone; icon: LucideIcon; color: string }> = {
  new: { label: OUTLET_STATUS_LABELS.new, tone: 'info', icon: Sparkles, color: '#2563eb' },
  prospect: { label: OUTLET_STATUS_LABELS.prospect, tone: 'paused', icon: Target, color: '#d97706' },
  active: { label: OUTLET_STATUS_LABELS.active, tone: 'active', icon: CheckCircle2, color: '#16a34a' },
  inactive: { label: OUTLET_STATUS_LABELS.inactive, tone: 'ended', icon: PauseCircle, color: '#64748b' },
  closed: { label: OUTLET_STATUS_LABELS.closed, tone: 'alert', icon: CircleSlash, color: '#dc2626' },
}

export const STATUSES = Object.values(OutletStatus)

export function useOutletForm() {
  return useQuery({
    queryKey: ['outlets', 'form'],
    queryFn: async () => (await api.get<OutletForm>('/outlets/form')).data,
    staleTime: 60_000,
  })
}

export function useOutlet(id: string | null) {
  return useQuery({
    queryKey: ['outlets', 'detail', id],
    enabled: !!id,
    queryFn: async () => (await api.get<OutletDetail>(`/outlets/${id}`)).data,
  })
}

/** Réponse d'un champ de la fiche, lisible. */
export function fieldValue(field: MissionField, value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (field.type === 'boolean') return value ? 'Oui' : 'Non'
  if (field.type === 'date' && typeof value === 'string') {
    const [y, m, d] = value.split('-')
    return `${d}/${m}/${y}`
  }
  if (field.type === 'number' && typeof value === 'number') return value.toLocaleString('fr-FR')
  return typeof value === 'string' ? value : JSON.stringify(value)
}
