import { Role, ZoneRequestStatus } from '@suivi/shared'
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, errorMessage } from './api'
import type { Group, MissionType, Page, User, Zone } from './types'

export const useZones = (includeInactive = false) =>
  useQuery({
    queryKey: ['zones', { includeInactive }],
    queryFn: async () => (await api.get<Zone[]>('/zones', { params: { includeInactive: includeInactive || undefined } })).data,
  })

export const useGroups = (includeInactive = false) =>
  useQuery({
    queryKey: ['groups', { includeInactive }],
    queryFn: async () => (await api.get<Group[]>('/groups', { params: { includeInactive: includeInactive || undefined } })).data,
  })

/** Tous les utilisateurs du périmètre (jusqu'à 200), pour les listes de choix. */
export const useAllUsers = (role?: Role) =>
  useQuery({
    queryKey: ['users', 'all', role],
    queryFn: async () => (await api.get<Page<User>>('/users', { params: { role, limit: 200 } })).data.items,
  })

export const useAgents = () => useAllUsers(Role.Agent)

export const useMissionTypes = (includeInactive = false) =>
  useQuery({
    queryKey: ['mission-types', { includeInactive }],
    queryFn: async () =>
      (await api.get<MissionType[]>('/mission-types', { params: { includeInactive: includeInactive || undefined } })).data,
  })

/**
 * Mutation avec message de succès, message d'erreur et invalidation du cache.
 * Les erreurs métier de l'API sont affichées telles quelles (messages en français).
 */
export function useApiMutation<TInput, TResult = unknown>(
  fn: (input: TInput) => Promise<TResult>,
  options: { success?: string; invalidate?: QueryKey[]; onSuccess?: (result: TResult) => void } = {},
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      if (options.success) toast.success(options.success)
      for (const key of options.invalidate ?? []) void queryClient.invalidateQueries({ queryKey: key })
      options.onSuccess?.(result)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

/** Nombre de demandes de zone en attente, rafraîchi en temps réel (clé « zone-requests »). */
export function usePendingRequests(): number {
  const query = useQuery({
    queryKey: ['zone-requests', 'pending-count'],
    queryFn: async () =>
      (await api.get<Page<unknown>>('/zone-requests', { params: { status: ZoneRequestStatus.Pending, limit: 1 } })).data.total,
    refetchInterval: 60_000,
  })
  return query.data ?? 0
}
