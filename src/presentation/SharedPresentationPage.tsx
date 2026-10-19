import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect } from 'react'
import { useParams } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { PresentationView } from './PresentationView'
import type { PresentationContent } from './types'

/**
 * Présentation ouverte par le lien partagé, sans compte. Le déroulé et les notes du
 * présentateur n'y figurent pas ; la page n'est pas référencée par les moteurs de recherche.
 */
export function SharedPresentationPage() {
  const { token = '' } = useParams()
  const query = useQuery({
    queryKey: ['public', 'presentation', token],
    queryFn: async () => (await axios.get<{ content: PresentationContent }>(`/api/public/presentations/${encodeURIComponent(token)}`)).data,
    retry: false,
    staleTime: Infinity,
  })
  const name = query.data?.content.clientName

  useEffect(() => {
    const previous = document.title
    document.title = name ? `PerformX × ${name}` : 'Présentation PerformX'
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.append(robots)
    return () => {
      document.title = previous
      robots.remove()
    }
  }, [name])

  if (query.isPending) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6" aria-busy="true" aria-label="Chargement">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="aspect-video w-full" />
      </div>
    )
  }
  if (query.isError) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#f5f5f7] p-6 text-center text-[#1d1d1f]">
        <div className="max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Présentation introuvable</h1>
          <p className="mt-2 text-[15px] text-[#424245]">
            Ce lien n’est plus valable. Demandez un nouveau lien à la personne qui vous l’a envoyé.
          </p>
        </div>
      </main>
    )
  }
  return (
    <div className="min-h-svh bg-[#f5f5f7]">
      <PresentationView content={query.data.content} forPresenter={false} />
    </div>
  )
}
