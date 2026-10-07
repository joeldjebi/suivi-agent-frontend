import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Archive, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useApiMutation } from '@/lib/queries'
import type { QueryKey } from '@tanstack/react-query'

interface ImpactResponse {
  impact: Record<string, number>
  requiresForce: boolean
}

export interface RemoveTarget {
  /** Nom affiché et à saisir pour confirmer une suppression en cascade */
  name: string
  isActive: boolean
}

export interface RemoveConfig {
  /** « la zone », « le groupe »… */
  noun: string
  /** Ex. : /zones/123 — sert pour /impact, PATCH et DELETE */
  url: string
  /** Effet de la désactivation, en une phrase */
  deactivateEffect: string
  deactivateLabel?: string
  /** Conséquence de la suppression, par type de données liées */
  impactLabels: Record<string, string>
  invalidate: QueryKey[]
  onRemoved?: () => void
}

/**
 * Opération critique : la désactivation (réversible) est proposée d'abord ;
 * la suppression définitive détaille ce qu'elle emporte et se confirme en saisissant le nom.
 */
export function RemoveDialog({
  target,
  config,
  onOpenChange,
}: {
  target: RemoveTarget | null
  config: RemoveConfig | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!target && !!config} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {target && config && <RemoveContent target={target} config={config} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function RemoveContent({ target, config, onDone }: { target: RemoveTarget; config: RemoveConfig; onDone: () => void }) {
  const [step, setStep] = useState<'choose' | 'delete'>(target.isActive ? 'choose' : 'delete')
  const [typed, setTyped] = useState('')
  const impact = useQuery({
    queryKey: ['impact', config.url],
    queryFn: async () => (await api.get<ImpactResponse>(`${config.url}/impact`)).data,
  })

  const deactivate = useApiMutation(() => api.patch(config.url, { isActive: false }), {
    success: `Désactivation effectuée : « ${target.name} ». Elle est réversible.`,
    invalidate: config.invalidate,
    onSuccess: onDone,
  })
  const remove = useApiMutation(() => api.delete(config.url, { params: { force: impact.data?.requiresForce || undefined } }), {
    success: `Suppression définitive effectuée : « ${target.name} ».`,
    invalidate: config.invalidate,
    onSuccess: () => {
      onDone()
      config.onRemoved?.()
    },
  })

  const linked = Object.entries(impact.data?.impact ?? {}).filter(([, n]) => n > 0)
  const needsTyping = !!impact.data?.requiresForce
  const confirmed = !needsTyping || typed.trim() === target.name.trim()

  if (step === 'choose') {
    return (
      <>
        <DialogHeader>
          <DialogTitle>
            Retirer {config.noun} « {target.name} »
          </DialogTitle>
          <DialogDescription>Choisissez comment retirer cet élément.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => deactivate.mutate(undefined)}
            disabled={deactivate.isPending}
            className="flex items-start gap-3 rounded-lg border-2 border-primary/30 bg-primary/5 p-3 text-left transition-colors hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
          >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              {deactivate.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Archive className="size-4" aria-hidden />}
            </span>
            <span>
              <span className="flex items-center gap-2 font-medium">
                {config.deactivateLabel ?? 'Désactiver'}
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-primary">Recommandé</span>
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {config.deactivateEffect} L'historique est conservé et l'opération est réversible.
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStep('delete')}
            className="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-destructive/40 hover:bg-destructive/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <Trash2 className="size-4" aria-hidden />
            </span>
            <span>
              <span className="font-medium">Supprimer définitivement</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                Supprime l'élément et, en cascade, les données qui lui sont liées. Irréversible.
              </span>
            </span>
          </button>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onDone}>
            Annuler
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Supprimer définitivement {config.noun} « {target.name} » ?
        </DialogTitle>
        <DialogDescription>Cette action est irréversible.</DialogDescription>
      </DialogHeader>
      {impact.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Analyse des données liées…
        </p>
      ) : linked.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune donnée n'est liée à cet élément.</p>
      ) : (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="size-4" aria-hidden /> Suppression en cascade
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {linked.map(([key, count]) => (
              <li key={key} className="flex gap-2">
                <span className="w-12 shrink-0 text-right font-semibold tabular-nums">{count.toLocaleString('fr-FR')}</span>
                <span>{config.impactLabels[key] ?? key}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {needsTyping && (
        <Field>
          <FieldLabel htmlFor="confirm-name">Pour confirmer, saisissez « {target.name} »</FieldLabel>
          <Input id="confirm-name" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          <FieldDescription>La désactivation reste possible si vous voulez conserver l'historique.</FieldDescription>
        </Field>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={target.isActive ? () => setStep('choose') : onDone}>
          {target.isActive ? 'Retour' : 'Annuler'}
        </Button>
        <Button
          className="bg-destructive text-white hover:bg-destructive/90"
          disabled={impact.isPending || !confirmed || remove.isPending}
          onClick={() => remove.mutate(undefined)}
        >
          {remove.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
          Supprimer définitivement
        </Button>
      </div>
    </>
  )
}

/** Libellés des conséquences, par entité (alignés sur les réponses /impact de l'API). */
export const IMPACT_LABELS = {
  zone: {
    requests: 'demande(s) de zone supprimée(s) de l’historique',
    days: 'journée(s) passée(s) n’auront plus de zone',
    groups: 'groupe(s) perdront cette zone',
  },
  group: {
    agents: 'agent(s) ne seront plus rattachés à aucun groupe',
    missions: 'mission(s) du groupe supprimée(s), avec leurs formulaires',
    zones: 'attribution(s) de zone retirée(s)',
  },
  user: {
    days: 'journée(s) de travail supprimée(s)',
    positions: 'position(s) GPS supprimée(s)',
    submissions: 'formulaire(s) de mission supprimé(s)',
    missions: 'mission(s) individuelle(s) supprimée(s)',
    ledGroups: 'groupe(s) perdront leur chef d’équipe',
  },
  missionType: { missions: 'mission(s) de ce type supprimée(s), avec leurs formulaires' },
  mission: { submissions: 'formulaire(s) reçu(s) supprimé(s)' },
}
