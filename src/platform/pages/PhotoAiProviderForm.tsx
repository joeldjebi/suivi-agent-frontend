import { PHOTO_AI_PROVIDER_LABELS, type PhotoAiProviderChoice } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, CircleSlash, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { useApiMutation } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { platformApi } from '../api'
import type { PhotoAiOverview } from '../types'

const ENV_KEYS: Record<string, string> = { anthropic: 'ANTHROPIC_API_KEY', mistral: 'MISTRAL_API_KEY' }
const usd = (v: number) => `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`

/**
 * IA photo : l'éditeur choisit le fournisseur qui analyse les photos de rayon de toutes les
 * structures. Seul un fournisseur dont la clé est dans la configuration du serveur peut l'être.
 */
export function PhotoAiProviderForm() {
  const query = useQuery({
    queryKey: ['platform', 'photo-ai'],
    queryFn: async () => (await platformApi.get<PhotoAiOverview>('/photo-ai')).data,
  })
  const o = query.data
  // Choix en cours ; sans clic, celui qui est enregistré.
  const [picked, setChoice] = useState<PhotoAiProviderChoice | null>(null)
  const choice = picked ?? o?.choice ?? 'off'
  const save = useApiMutation(() => platformApi.patch('/settings', { photoAiProvider: choice }), {
    success: 'Fournisseur de l’IA photo enregistré',
    invalidate: [['platform']],
    onSuccess: () => setChoice(null),
  })
  const options = [...(o?.providers ?? []), { id: 'off' as const, label: PHOTO_AI_PROVIDER_LABELS.off, configured: true, model: null }]

  return (
    <QueryState query={query} rows={3}>
      {o && (
        <div className="max-w-2xl rounded-lg border bg-card">
          <div role="radiogroup" aria-label="Fournisseur de l’IA photo" className="grid gap-2 p-4 sm:grid-cols-3">
            {options.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={choice === p.id}
                disabled={!p.configured}
                onClick={() => setChoice(p.id)}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm transition-colors',
                  choice === p.id && 'border-primary bg-primary/5 ring-1 ring-primary',
                  !p.configured && 'cursor-not-allowed opacity-60',
                )}
              >
                <span className="font-medium">{p.label}</span>
                {p.id === 'off' ? (
                  <span className="text-xs text-muted-foreground">Aucune photo analysée</span>
                ) : p.configured ? (
                  <span className="flex items-center gap-1 text-xs text-status-active">
                    <CircleCheck className="size-3.5" aria-hidden /> Branché · {p.model}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CircleSlash className="size-3.5" aria-hidden /> Clé {ENV_KEYS[p.id]} absente du .env
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="border-t p-4 text-sm">
            <p className="font-medium">Ce mois-ci ({o.month})</p>
            {o.usage.length === 0 ? (
              <p className="text-muted-foreground">Aucune photo analysée.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-0.5">
                {o.usage.map((u) => (
                  <li key={u.provider} className="flex justify-between gap-2">
                    <span>{PHOTO_AI_PROVIDER_LABELS[u.provider as PhotoAiProviderChoice] ?? u.provider}</span>
                    <span className="tabular-nums">
                      {u.analyses} photo{u.analyses > 1 ? 's' : ''} · {usd(u.costUsd)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Le changement vaut pour toutes les structures, dès la prochaine photo. Les clés restent dans le fichier .env du serveur,
              jamais dans la console.
            </p>
          </div>
          <div className="flex justify-end border-t p-3">
            <Button onClick={() => save.mutate(undefined)} disabled={choice === o.choice || save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Enregistrer
            </Button>
          </div>
        </div>
      )}
    </QueryState>
  )
}
