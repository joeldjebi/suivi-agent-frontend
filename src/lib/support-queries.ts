import { SupportStatus, type SupportTicketInfo } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'

/** Demandes auxquelles le support a répondu (pastille du menu « Support »). */
export function useSupportAnswers(): number {
  const query = useQuery({
    queryKey: ['support'],
    queryFn: async () => (await api.get<SupportTicketInfo[]>('/support/tickets')).data,
    refetchInterval: 120_000,
  })
  return (query.data ?? []).filter((t) => t.status === SupportStatus.Answered).length
}
