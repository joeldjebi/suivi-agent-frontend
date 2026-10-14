import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { api } from '@/lib/api'

/** Image protégée (jeton de session) : chargée par l'API puis affichée depuis la mémoire. */
export function usePhotoUrl(id: string) {
  const blob = useQuery({
    queryKey: ['photos', id],
    queryFn: async () => (await api.get<Blob>(`/photos/${id}`, { responseType: 'blob' })).data,
    staleTime: Infinity,
  })
  const url = useMemo(() => (blob.data ? URL.createObjectURL(blob.data) : null), [blob.data])
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url])
  return { url, isError: blob.isError }
}
