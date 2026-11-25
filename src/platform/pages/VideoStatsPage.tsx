import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Clock, PlayCircle, Users, Video } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, Page, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { appareil, drapeau, paysNom, provenance } from '@/lib/visit-format'
import { platformApi } from '../api'
import type { Paged } from '../types'

interface View {
  id: string
  seconds: number
  percent: number
  duration: number | null
  orientation: string | null
  userAgent: string | null
  referer: string | null
  retour: boolean
  createdAt: string
  pays: string | null
  ville: string | null
}
interface Summary {
  vues: number
  vues7j: number
  visiteurs: number
  tempsMoyen: number
}

const PAGE_SIZE = 30

function duree(s: number) {
  if (!s) return '0s'
  const m = Math.floor(s / 60)
  const r = Math.round(s % 60)
  return m > 0 ? `${m} min ${r.toString().padStart(2, '0')}` : `${r}s`
}

/** Statistiques de lecture de la vidéo de présentation (page publique /video). */
export function VideoStatsPage() {
  const [page, setPage] = useState(1)
  const host = typeof window !== 'undefined' ? window.location.host : ''
  const list = useQuery({
    queryKey: ['platform', 'video-views', { page }],
    placeholderData: keepPreviousData,
    queryFn: async () => (await platformApi.get<Paged<View>>('/video-views', { params: { page, limit: PAGE_SIZE } })).data,
  })
  const summary = useQuery({
    queryKey: ['platform', 'video-summary'],
    queryFn: async () => (await platformApi.get<Summary>('/video-views/summary')).data,
  })
  const s = summary.data

  return (
    <Page>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Visites vidéo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ouvertures de la page{' '}
          <a href={`https://${host}/video`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            {host}/video
          </a>{' '}
          : quand, d’où et combien de temps.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi icon={PlayCircle} value={s?.vues ?? 0} label="Visites" sub={`${s?.vues7j ?? 0} sur les 7 derniers jours`} />
        <Kpi icon={Users} value={s?.visiteurs ?? 0} label="Visiteurs différents" sub="Même appareil et même réseau = un visiteur" />
        <Kpi icon={Clock} value={s ? duree(s.tempsMoyen) : '—'} label="Durée regardée en moyenne" sub="Parmi les visites où la vidéo a été lancée" />
      </div>

      <QueryState query={list} rows={6}>
        {list.data?.items.length === 0 ? (
          <EmptyState icon={Video} title="Aucune visite" description="Les ouvertures de la page vidéo apparaîtront ici." />
        ) : (
          <div className={cn('overflow-x-auto rounded-lg border bg-card', list.isFetching && 'opacity-70')}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Date et heure</th>
                  <th className="px-4 py-3 font-medium">Lieu</th>
                  <th className="px-4 py-3 font-medium">Appareil</th>
                  <th className="px-4 py-3 font-medium">Provenance</th>
                  <th className="px-4 py-3 text-right font-medium">Regardé</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.items.map((v) => {
                  const ap = appareil(v.userAgent)
                  return (
                    <tr key={v.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="tabular-nums">{formatDateTime(v.createdAt)}</span>
                        {v.retour && (
                          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Retour</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {v.pays ? (
                          <span>
                            <span className="mr-1">{drapeau(v.pays)}</span>
                            {[v.ville, paysNom(v.pays)].filter(Boolean).join(', ')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Inconnu</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p>{ap.type}</p>
                        <p className="text-xs text-muted-foreground">{ap.os}</p>
                      </td>
                      <td className="px-4 py-3">{provenance(v.referer, host)}</td>
                      <td className="px-4 py-3 text-right">
                        {v.seconds > 0 ? (
                          <>
                            <p className="tabular-nums">{duree(v.seconds)}</p>
                            <p className="text-xs text-muted-foreground">{v.percent} % de la vidéo</p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Pas lancée</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
      {list.data && (
        <Pagination
          page={list.data.page}
          pages={Math.max(1, Math.ceil(list.data.total / PAGE_SIZE))}
          total={list.data.total}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      )}
    </Page>
  )
}

function Kpi({ icon: Icon, value, label, sub }: { icon: typeof Clock; value: string | number; label: string; sub: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden /> {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}
