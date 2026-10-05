import { useQuery } from '@tanstack/react-query'
import { planName } from '@/lib/subscription'
import { platformApi } from './api'
import type { Plan } from './types'

/** Catalogue des formules (y compris retirées), partagé par les pages de la console. */
export function usePlans() {
  return useQuery({
    queryKey: ['platform', 'plans'],
    queryFn: async () => (await platformApi.get<Plan[]>('/plans')).data,
    staleTime: 60_000,
  })
}

/** Nom d'une formule par son code, d'après le catalogue chargé. */
export function usePlanName(): (code: string | null | undefined) => string {
  const { data } = usePlans()
  return (code) => (code ? (data?.find((p) => p.code === code)?.name ?? planName(code)) : '—')
}
