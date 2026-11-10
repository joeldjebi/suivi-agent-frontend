import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { api } from '@/lib/api'

/**
 * Photo de profil (protégée par le jeton de session) chargée par l'API puis affichée depuis
 * la mémoire. `version` sert de cache (change à chaque nouvelle photo) ; null = pas de photo.
 */
export function useAvatarUrl(id: string, version: number | null | undefined): string | null {
  const blob = useQuery({
    queryKey: ['avatar', id, version],
    enabled: version != null,
    queryFn: async () => (await api.get<Blob>(`/users/${id}/avatar`, { responseType: 'blob' })).data,
    staleTime: Infinity,
  })
  const url = useMemo(() => (blob.data ? URL.createObjectURL(blob.data) : null), [blob.data])
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url])
  return url
}
