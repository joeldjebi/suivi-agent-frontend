import type { OnboardingState } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export const onboardingKey = ['onboarding']

/** Avancement du guide « Bien démarrer » (administrateur). */
export function useOnboarding(enabled = true) {
  return useQuery({
    queryKey: onboardingKey,
    enabled,
    queryFn: async () => (await api.get<OnboardingState>('/onboarding')).data,
    staleTime: 30_000,
  })
}
