import {
  onboardingNetPrice,
  TENANT_APPROVAL_STATUS_LABELS,
  type OnboardingPackage,
  type TenantApprovalStatus as ApprovalStatus,
} from '@suivi/shared'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { useState } from 'react'
import { StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useApiMutation } from '@/lib/queries'
import { platformApi } from './api'
import { formatMoney } from './labels'
import type { PlatformRegistration } from './types'

/** Pastille de l'état de validation d'une structure. */
export function RegistrationStatusPill({ status }: { status: ApprovalStatus }) {
  const look = {
    pending: { tone: 'paused', icon: Clock },
    approved: { tone: 'active', icon: CheckCircle2 },
    rejected: { tone: 'alert', icon: XCircle },
  } as const
  return <StatusPill tone={look[status].tone} icon={look[status].icon} label={TENANT_APPROVAL_STATUS_LABELS[status]} />
}

/**
 * Valider une inscription : la structure est activée, son essai démarre, et la mise en place
 * obligatoire (forfait choisi, au prix réduit du pourcentage indiqué) est ajoutée à sa première
 * facture. 100 % de réduction = mise en place offerte.
 */
export function ApproveRegistrationDialog({
  registration,
  packages,
  onClose,
}: {
  registration: PlatformRegistration
  packages: OnboardingPackage[]
  onClose: () => void
}) {
  const [code, setCode] = useState(packages[0]?.code ?? '')
  const pkg = packages.find((p) => p.code === code)
  const [discount, setDiscount] = useState(String(pkg?.discountPercent ?? 0))
  const d = Math.min(100, Math.max(0, Number(discount) || 0))
  const net = pkg ? onboardingNetPrice(pkg.price, d) : 0
  const save = useApiMutation(
    () =>
      platformApi.post(`/registrations/${registration.tenantId}/approve`, {
        packageCode: code || undefined,
        discountPercent: Number.isFinite(d) ? d : undefined,
      }),
    {
      success: 'Structure validée : essai démarré, mise en place sur la 1re facture',
      invalidate: [['platform']],
      onSuccess: onClose,
    },
  )
  const choosePackage = (value: string | null) => {
    if (!value) return
    setCode(value)
    setDiscount(String(packages.find((p) => p.code === value)?.discountPercent ?? 0))
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Valider « {registration.tenantName} »</DialogTitle>
          <DialogDescription>
            La structure est activée et son essai démarre. La mise en place est ajoutée à sa première facture.
          </DialogDescription>
        </DialogHeader>
        {packages.length === 0 ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Aucun forfait de mise en place configuré : la structure sera activée sans frais de mise en place.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-package">Forfait de mise en place</Label>
              <Select value={code} onValueChange={choosePackage}>
                <SelectTrigger id="reg-package" className="w-full">
                  <SelectValue>{(v: string) => packages.find((p) => p.code === v)?.name ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {packages.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.name} · {formatMoney(p.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-discount">Réduction (%)</Label>
              <Input
                id="reg-discount"
                inputMode="numeric"
                value={discount}
                onChange={(e) => setDiscount(e.target.value.replace(/\D/g, '').slice(0, 3))}
              />
              <p className="text-xs text-muted-foreground">
                {d >= 100
                  ? 'Mise en place offerte (aucun frais).'
                  : `Facturé : ${formatMoney(net)}${d > 0 && pkg ? ` (au lieu de ${formatMoney(pkg.price)})` : ''}`}
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate(undefined)}>
            Valider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Refuser une inscription : la structure reste bloquée, le motif est transmis à ses administrateurs. */
export function RejectRegistrationDialog({
  registration,
  onClose,
}: {
  registration: PlatformRegistration
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const save = useApiMutation(
    () => platformApi.post(`/registrations/${registration.tenantId}/reject`, { reason: reason.trim() }),
    { success: 'Inscription refusée', invalidate: [['platform']], onSuccess: onClose },
  )
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refuser « {registration.tenantName} »</DialogTitle>
          <DialogDescription>Le motif est envoyé aux administrateurs de la structure, qui reste bloquée.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reg-reason">Motif</Label>
          <Textarea
            id="reg-reason"
            rows={3}
            maxLength={300}
            value={reason}
            aria-invalid={reason.trim() === ''}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="destructive" disabled={reason.trim() === '' || save.isPending} onClick={() => save.mutate(undefined)}>
            Refuser
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
