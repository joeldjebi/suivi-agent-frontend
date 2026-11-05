import { type PhotoAiResult, type PhotoAnalysisStatus } from '@suivi/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** Analyse d'une photo de rayon par l'IA. */
export interface PhotoAnalysis {
  photoId: string
  status: PhotoAnalysisStatus
  skipReason: string | null
  skipLabel: string | null
  result: PhotoAiResult | null
  products: Record<string, { name: string; format: string | null; own: boolean }>
  provider: string | null
  model: string | null
  error: string | null
  attempts: number
  createdAt: string
  analyzedAt: string | null
}

export interface PhotoAiUsage {
  month: string
  quota: number
  bonus: number
  used: number
  remaining: number
  auto: boolean
  configured: boolean
}

export interface ShelfStats {
  analyses: number
  outletCount: number
  avgScore: number | null
  /** Part de rayon de nos produits, en % des faces */
  share: number | null
  weeks: { week: string; analyses: number; avgScore: number; share: number | null }[]
  products: {
    productId: string
    name: string
    format: string | null
    own: boolean
    analyses: number
    /** % des photos où le produit est vu */
    presence: number
    avgFacings: number | null
    avgPrice: number | null
  }[]
  outlets: {
    outletId: string
    outletName: string
    analyzedAt: string
    score: number
    share: number | null
    missing: string[]
    photoId: string
    submissionId: string | null
    agent: string
  }[]
}

const WAITING: PhotoAnalysisStatus[] = ['pending', 'running']

/** Analyse d'une photo (null : aucune) ; relue toutes les 5 s tant qu'elle est en cours. */
export function usePhotoAnalysis(photoId: string, enabled = true) {
  return useQuery({
    queryKey: ['photo-analysis', photoId],
    enabled,
    queryFn: async () => {
      const res = await api.get<PhotoAnalysis>(`/photo-ai/photos/${photoId}`, { validateStatus: (s) => s === 200 || s === 404 })
      return res.status === 404 ? null : res.data
    },
    refetchInterval: (q) => (q.state.data && WAITING.includes(q.state.data.status) ? 5000 : false),
  })
}

export function usePhotoAiUsage(enabled = true) {
  return useQuery({
    queryKey: ['photo-ai-usage'],
    enabled,
    queryFn: async () => (await api.get<PhotoAiUsage>('/photo-ai/usage')).data,
  })
}

/** Lendemain d'un jour « AAAA-MM-JJ » (l'API attend une fin exclue). */
const nextDay = (day: string) => new Date(new Date(`${day}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10)

export function useShelfStats(from: string, to: string) {
  return useQuery({
    queryKey: ['photo-ai-stats', from, to],
    queryFn: async () => (await api.get<ShelfStats>('/photo-ai/stats', { params: { from, to: nextDay(to) } })).data,
    placeholderData: keepPreviousData,
  })
}

/** Couleur d'un score de rayon : bon à partir de 70, moyen à partir de 40. */
export function scoreTone(score: number): 'active' | 'paused' | 'alert' {
  return score >= 70 ? 'active' : score >= 40 ? 'paused' : 'alert'
}

export const CONFIDENCE_LABELS: Record<string, string> = { high: 'sûre', medium: 'moyenne', low: 'faible' }
