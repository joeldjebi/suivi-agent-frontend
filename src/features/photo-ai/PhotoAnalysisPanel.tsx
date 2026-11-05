import { PHOTO_AI_PROVIDER_LABELS, type PhotoAiProviderChoice } from '@suivi/shared'
import { AlertTriangle, Bot, CircleCheck, CircleX, Loader2, RotateCw, Sparkles } from 'lucide-react'
import { StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { formatMoney } from '@/lib/subscription'
import { cn } from '@/lib/utils'
import { CONFIDENCE_LABELS, scoreTone, usePhotoAnalysis } from './photo-ai'

/**
 * Résultat de l'IA pour une photo de rayon : score, produits vus ou absents (faces, prix lus),
 * produits hors catalogue, remarque. Un responsable peut demander (ou relancer) l'analyse.
 */
export function PhotoAnalysisPanel({ photoId, canRequest }: { photoId: string; canRequest: boolean }) {
  const query = usePhotoAnalysis(photoId)
  const a = query.data
  const request = useApiMutation(() => api.post(`/photo-ai/photos/${photoId}/analyze`), {
    success: 'Analyse demandée : le résultat arrive dans un instant',
    invalidate: [['photo-analysis', photoId], ['photo-ai-usage']],
  })
  const action = (label: string) =>
    canRequest && (
      <Button size="sm" variant="outline" onClick={() => request.mutate(undefined)} disabled={request.isPending}>
        {request.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCw aria-hidden />}
        {label}
      </Button>
    )

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Chargement de l’analyse…</p>
  if (!a)
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3 text-sm">
        <span className="text-muted-foreground">Photo pas encore analysée par l’IA.</span>
        {canRequest && (
          <Button size="sm" onClick={() => request.mutate(undefined)} disabled={request.isPending}>
            {request.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
            Analyser le rayon
          </Button>
        )}
      </div>
    )
  if (a.status === 'pending' || a.status === 'running')
    return (
      <p className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {a.attempts > 0 && a.error ? `Nouvel essai prévu (${a.error})` : 'Analyse en cours…'}
      </p>
    )
  if (a.status === 'skipped' || a.status === 'failed')
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-status-paused/40 bg-status-paused/5 p-3 text-sm">
        <span className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-status-paused" aria-hidden />
          {a.status === 'skipped' ? `Pas analysée : ${a.skipLabel}` : `L’analyse a échoué${a.error ? ` : ${a.error}` : ''}`}
        </span>
        {action('Relancer')}
      </div>
    )

  const r = a.result!
  const rows = r.products
    .map((p) => ({ ...p, info: a.products[p.productId] }))
    .filter((p) => p.info)
    .sort((x, y) => Number(y.info.own) - Number(x.info.own) || Number(y.present) - Number(x.present))
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusPill tone={scoreTone(r.shelfScore)} icon={Bot} label={`Score du rayon : ${r.shelfScore} / 100`} />
        {action('Relancer l’analyse')}
      </div>
      {r.notes && <p className="text-muted-foreground">{r.notes}</p>}
      {rows.length > 0 && (
        <ul className="divide-y rounded-md border">
          {rows.map((p) => (
            <li key={p.productId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
              <span className="flex items-center gap-2">
                {p.present ? (
                  <CircleCheck className="size-4 shrink-0 text-status-active" aria-label="Présent" />
                ) : (
                  <CircleX
                    className={cn('size-4 shrink-0', p.info.own ? 'text-status-alert' : 'text-muted-foreground')}
                    aria-label="Absent"
                  />
                )}
                <span>
                  {p.info.name}
                  {p.info.format && <span className="text-muted-foreground"> · {p.info.format}</span>}
                  {!p.info.own && <span className="ml-1.5 text-xs text-status-paused">concurrent</span>}
                </span>
              </span>
              <span className="text-muted-foreground">
                {p.present
                  ? [
                      p.facings != null ? `${p.facings} face${p.facings > 1 ? 's' : ''}` : null,
                      p.price != null ? formatMoney(p.price) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Présent'
                  : p.info.own
                    ? 'Absent du rayon'
                    : 'Absent'}
                {p.confidence !== 'high' && (
                  <span className="ml-1.5 text-xs" title="Confiance de l’IA">
                    (confiance {CONFIDENCE_LABELS[p.confidence]})
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {r.others.length > 0 && (
        <p>
          <span className="text-muted-foreground">Aussi vus (hors catalogue) : </span>
          {r.others.map((o) => `${o.name}${o.facings ? ` (${o.facings} face${o.facings > 1 ? 's' : ''})` : ''}`).join(', ')}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Analysée {a.analyzedAt ? `le ${formatDateTime(a.analyzedAt)}` : ''}
        {a.provider && ` par ${PHOTO_AI_PROVIDER_LABELS[a.provider as PhotoAiProviderChoice] ?? a.provider}`} · résultat proposé par l’IA, à
        vérifier
      </p>
    </div>
  )
}
