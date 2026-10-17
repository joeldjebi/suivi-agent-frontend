import type { MissionField, Packaging } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import { QueryState } from '@/components/app/page'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { formatMoney } from '@/lib/subscription'
import type { PhotoMeta } from '@/lib/types'
import { SubmissionPhoto } from '../missions/SubmissionPhoto'
import { formatQuantity, productName } from '../products/products'
import { fieldValue } from './outlets'

interface Reading {
  productId: string
  name: string
  format: string | null
  own: boolean
  unit: string
  packagings: Packaging[]
  presence: boolean | null
  stock: number | null
  price: number | null
  sold: number | null
}

interface VisitDetail {
  id: string
  formName: string
  agent: string
  submittedAt: string
  distance: number | null
  status: string
  rejectedReason: string | null
  fields: MissionField[]
  data: Record<string, unknown>
  photos: Record<string, PhotoMeta>
  readings: Reading[]
}

/** Détail d'une visite libre : réponses, relevé des produits et photos (agrandissement, position). */
export function VisitDetailDialog({ visitId, onClose }: { visitId: string | null; onClose: () => void }) {
  return (
    <Dialog open={!!visitId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">{visitId && <VisitBody id={visitId} />}</DialogContent>
    </Dialog>
  )
}

function VisitBody({ id }: { id: string }) {
  const visit = useQuery({
    queryKey: ['outlet-visit', id],
    queryFn: async () => (await api.get<VisitDetail>(`/outlets/visits/${id}`)).data,
  })
  const v = visit.data
  const answers = v?.fields.filter((f) => f.type !== 'photo' && f.type !== 'products') ?? []
  const photos = v?.fields.filter((f) => f.type === 'photo' && typeof v.data[f.key] === 'string') ?? []

  return (
    <>
      <DialogHeader>
        <DialogTitle>{v ? `Visite · ${v.formName}` : 'Visite'}</DialogTitle>
        <DialogDescription>
          {v
            ? [formatDateTime(v.submittedAt), v.agent, v.distance != null ? `à ${v.distance} m du point de vente` : null]
                .filter(Boolean)
                .join(' · ')
            : ''}
        </DialogDescription>
      </DialogHeader>
      <QueryState query={visit}>
        {v && (
          <div className="flex flex-col gap-4 text-sm">
            {v.status === 'rejected' && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
                Visite rejetée{v.rejectedReason ? ` : ${v.rejectedReason}` : ''}
              </p>
            )}
            {answers.length > 0 && (
              <section className="flex flex-col gap-1">
                <h3 className="font-medium">Réponses</h3>
                <dl className="divide-y rounded-lg border">
                  {answers.map((f) => (
                    <div key={f.key} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                      <dt className="text-muted-foreground">{f.label}</dt>
                      <dd className="text-right font-medium">{fieldValue(f, v.data[f.key]) ?? '—'}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            {v.readings.length > 0 && (
              <section className="flex flex-col gap-1">
                <h3 className="font-medium">Produits relevés</h3>
                <ul className="divide-y rounded-lg border">
                  {v.readings.map((r) => (
                    <li key={r.productId} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                      <span>
                        {productName(r)}
                        {!r.own && <span className="ml-1.5 text-xs text-status-paused">concurrent</span>}
                      </span>
                      <span className={r.presence === false ? 'text-status-alert' : 'text-muted-foreground'}>
                        {r.presence === false
                          ? 'Rupture'
                          : [
                              r.stock != null ? `Stock ${formatQuantity(r.stock, r)}` : null,
                              r.price != null ? formatMoney(r.price) : null,
                              r.sold ? `Vendu ${formatQuantity(r.sold, r)}` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Présent'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="flex flex-col gap-1">
              <h3 className="font-medium">Photos</h3>
              {photos.length === 0 ? (
                <p className="text-muted-foreground">Aucune photo pour cette visite.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {photos.map((f) => {
                    const photoId = v.data[f.key] as string
                    return (
                      <div key={f.key} className="flex flex-col gap-1">
                        <SubmissionPhoto id={photoId} meta={v.photos[photoId]} label={f.label} agentName={v.agent} zoneIds={[]} />
                        <span className="max-w-32 text-xs text-muted-foreground">{f.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </QueryState>
    </>
  )
}
