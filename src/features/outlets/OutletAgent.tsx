import { Role } from '@suivi/shared'
import { ArrowRight, Loader2, UserRoundCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { useAgents, useApiMutation } from '@/lib/queries'
import type { OutletDetail } from './outlets'

const NONE = 'none'

/** Ce que l'on transfère : des points de vente choisis, ou tous ceux d'un agent. */
export type TransferTarget =
  | {
      kind: 'outlets'
      ids: string[]
      label: string
      currentAgentId: string | null
    }
  | { kind: 'agent'; agent: { id: string; name: string }; count: number }

/**
 * Transfert à un autre agent (ou « sans responsable » : visible des agents de la zone).
 * L'administrateur partout, le chef dans son équipe. Historisé ; les agents sont prévenus.
 */
export function TransferOutletsDialog({ target, onClose }: { target: TransferTarget | null; onClose: () => void }) {
  const agents = (useAgents().data ?? []).filter((a) => a.isActive)
  const [agentId, setAgentId] = useState<string>('')
  const [reason, setReason] = useState('')
  const current = target?.kind === 'outlets' ? target.currentAgentId : target?.agent.id
  useEffect(() => {
    if (target) {
      setAgentId('')
      setReason('')
    }
  }, [target])
  const save = useApiMutation(
    () =>
      api
        .post<{ updated: number }>('/outlets/assign', {
          ...(target?.kind === 'agent' ? { fromAgentId: target.agent.id } : { outletIds: target?.ids }),
          agentId: agentId === NONE ? null : agentId,
          reason: reason.trim() || undefined,
        })
        .then((r) => r.data),
    {
      invalidate: [['outlets']],
      onSuccess: (r) => {
        toast.success(
          r.updated === 0
            ? 'Rien à changer : déjà suivi par cet agent'
            : `${r.updated} point${r.updated > 1 ? 's' : ''} de vente transféré${r.updated > 1 ? 's' : ''}`,
        )
        onClose()
      },
    },
  )
  const choices = agents.filter((a) => a.id !== current)
  const what =
    target?.kind === 'agent' ? `les ${target.count} point${target.count > 1 ? 's' : ''} de vente de ${target.agent.name}` : target?.label

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transférer {what}</DialogTitle>
          <DialogDescription>
            Le nouvel agent responsable les retrouve dans son app ; l’ancien ne les voit plus (sauf mission de visites). Le changement est
            noté dans l’historique de chaque fiche.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="transfer-agent">Nouveau responsable</FieldLabel>
          <Select value={agentId} onValueChange={(v) => v && setAgentId(v)}>
            <SelectTrigger id="transfer-agent" className="w-full">
              <SelectValue>
                {(v: string) =>
                  !v
                    ? 'Choisir un agent'
                    : v === NONE
                      ? 'Sans responsable'
                      : (() => {
                          const a = agents.find((x) => x.id === v)
                          return a ? `${a.firstName} ${a.lastName}` : 'Agent'
                        })()
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {choices.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.firstName} {a.lastName}
                </SelectItem>
              ))}
              {current && <SelectItem value={NONE}>Sans responsable (agents de la zone)</SelectItem>}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="transfer-reason">Motif (facultatif)</FieldLabel>
          <Input
            id="transfer-reason"
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. : réorganisation des tournées, départ en congé"
          />
          <FieldDescription>Envoyé aux agents concernés et conservé dans l’historique.</FieldDescription>
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!agentId || save.isPending} onClick={() => save.mutate(undefined)}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Transférer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Fiche : agent responsable, bouton de transfert et historique des responsables. */
export function OutletAgentSection({ outlet }: { outlet: OutletDetail }) {
  const { user } = useMe()
  const canTransfer = user.role === Role.Admin || user.role === Role.TeamLead
  const [target, setTarget] = useState<TransferTarget | null>(null)
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <UserRoundCheck className="size-4 text-muted-foreground" aria-hidden />
          Agent responsable
        </h3>
        {canTransfer && (
          <Button
            size="xs"
            variant="outline"
            onClick={() =>
              setTarget({
                kind: 'outlets',
                ids: [outlet.id],
                label: `« ${outlet.name} »`,
                currentAgentId: outlet.agent?.id ?? null,
              })
            }
          >
            Transférer
          </Button>
        )}
      </div>
      <p className="text-sm">
        {outlet.agent ? (
          <span className="font-medium">{outlet.agent.name}</span>
        ) : (
          <span className="text-muted-foreground">Sans responsable : visible des agents de la zone</span>
        )}
      </p>
      {outlet.agentChanges.length > 0 && (
        <ol className="flex flex-col gap-2 border-l pl-4" aria-label="Historique des responsables">
          {outlet.agentChanges.map((c) => (
            <li key={c.id} className="text-sm">
              <p className="flex flex-wrap items-center gap-1">
                {c.from ? c.from.name : <span className="text-muted-foreground">Sans responsable</span>}
                <ArrowRight className="size-3.5" aria-label="puis" />
                <span className="font-medium">{c.to ? c.to.name : 'Sans responsable'}</span>
              </p>
              {c.reason && <p className="text-muted-foreground">« {c.reason} »</p>}
              <p className="text-xs text-muted-foreground">
                {formatDateTime(c.createdAt)}
                {c.by && ` · par ${c.by.name}`}
              </p>
            </li>
          ))}
        </ol>
      )}
      <TransferOutletsDialog target={target} onClose={() => setTarget(null)} />
    </section>
  )
}
