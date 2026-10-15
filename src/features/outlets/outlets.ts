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
  /** Fréquence propre (jours) ; null : celle de la structure */
  visitFrequencyDays: number | null
  /** Fréquence appliquée (jours) ; 0 : pas de suivi */
  frequencyDays: number
  lastVisitAt: string | null
  /** Visite attendue au plus tard */
  dueAt: string | null
  overdue: boolean
  daysSinceVisit: number | null
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
  /** null : visite libre (sans mission) */
  missionId: string | null
  missionTitle: string
  /** Formulaire rempli */
  formName: string
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
  /** En retard de visite */
  overdue: number
}

export interface OutletPoint {
  id: string
  name: string
  status: OutletStatus
  category: string | null
  lat: number
  lng: number
  overdue: boolean
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

/** « Visité il y a 12 j », « Visité aujourd'hui », « Jamais visité ». */
export function visitLabel(o: Pick<Outlet, 'daysSinceVisit' | 'lastVisitAt'>): string {
  if (!o.lastVisitAt || o.daysSinceVisit === null) return 'Jamais visité'
  if (o.daysSinceVisit === 0) return 'Visité aujourd’hui'
  return `Visité il y a ${o.daysSinceVisit} j`
}
