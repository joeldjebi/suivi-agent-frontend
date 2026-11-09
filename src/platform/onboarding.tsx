import { ONBOARDING_REQUEST_STATUS_LABELS, type OnboardingRequestStatus } from '@suivi/shared'
import { CheckCircle2, Clock, Undo2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useApiMutation } from '@/lib/queries'
import { platformApi } from './api'
import { formatMoney } from './labels'
import type { PlatformOnboardingRequest } from './types'

/** Pastille de l'état d'une demande de mise en place. */
export function OnboardingStatusPill({ status }: { status: OnboardingRequestStatus }) {
  const look = {
    pending: { tone: 'paused', icon: Clock },
    accepted: { tone: 'active', icon: CheckCircle2 },
    rejected: { tone: 'alert', icon: XCircle },
    cancelled: { tone: 'ended', icon: Undo2 },
  } as const
  return <StatusPill tone={look[status].tone} icon={look[status].icon} label={ONBOARDING_REQUEST_STATUS_LABELS[status]} />
}

/**
 * Accepter : les frais (prix du forfait demandé, modifiable) s'ajoutent à la prochaine facture ;
 * refuser : motif transmis à la structure. Les deux préviennent ses administrateurs.
 */
export function DecideOnboardingDialog({
  request,
  decision,
  onClose,
}: {
  request: PlatformOnboardingRequest
  decision: 'accept' | 'reject'
  onClose: () => void
}) {
  const [amount, setAmount] = useState(String(request.packagePrice))
  const [text, setText] = useState('')
  const accept = decision === 'accept'
  const save = useApiMutation(
    () =>
      platformApi.post(
        `/onboarding-requests/${request.id}/${decision}`,
        accept ? { amount: Number(amount), note: text.trim() || undefined } : { reason: text.trim() },
      ),
    {
      success: accept ? 'Demande acceptée : frais ajoutés à la prochaine facture' : 'Demande refusée',
      invalidate: [['platform']],
      onSuccess: onClose,
    },
  )
  const valid = accept ? amount !== '' && Number(amount) > 0 : text.trim() !== ''
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {accept ? 'Accepter' : 'Refuser'} « {request.packageName} »
          </DialogTitle>
          <DialogDescription>
            {request.tenantName ? `${request.tenantName} · ` : ''}
            {accept
              ? 'Les frais s’ajoutent à sa prochaine facture mensuelle ; ses administrateurs sont prévenus.'
              : 'Le motif est envoyé aux administrateurs de la structure.'}
          </DialogDescription>
        </DialogHeader>
        {request.message && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm">
            <span className="text-xs text-muted-foreground">Message de la structure : </span>
            {request.message}
          </p>
        )}
        {accept ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="onboarding-amount">Montant facturé (FCFA)</Label>
              <Input
                id="onboarding-amount"
                inputMode="numeric"
                value={amount}
                aria-invalid={!valid}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              />
              {Number(amount) !== request.packagePrice && amount !== '' && (
                <p className="text-xs text-muted-foreground">Prix du forfait demandé : {formatMoney(request.packagePrice)}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="onboarding-note">Mot pour la structure (facultatif)</Label>
              <Textarea
                id="onboarding-note"
                rows={2}
                maxLength={300}
                value={text}
                placeholder="ex. Nous vous appelons demain pour fixer les dates."
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="onboarding-reason">Motif</Label>
            <Textarea
              id="onboarding-reason"
              rows={3}
              maxLength={300}
              value={text}
              aria-invalid={!valid}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant={accept ? 'default' : 'destructive'}
            disabled={!valid || save.isPending}
            onClick={() => save.mutate(undefined)}
          >
            {accept ? 'Accepter' : 'Refuser'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
