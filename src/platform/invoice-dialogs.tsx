import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useApiMutation } from '@/lib/queries'
import { platformApi } from './api'
import { formatMoney, monthLabel, paymentMethodLabel } from './labels'
import type { Invoice } from './types'

const today = () => new Date().toISOString().slice(0, 10)

/** Paiement reçu hors plateforme : moyen, référence et date. La structure est prévenue. */
export function PaymentDialog({ invoice, tenantName, onClose }: { invoice: Invoice | null; tenantName?: string; onClose: () => void }) {
  const [method, setMethod] = useState('mobile_money')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState(today)
  const close = () => {
    setMethod('mobile_money')
    setReference('')
    setDate(today())
    onClose()
  }
  const save = useApiMutation(
    () =>
      platformApi.post(`/invoices/${invoice!.id}/payment`, {
        method,
        reference: reference.trim() || undefined,
        // Paiement du jour : l'heure exacte ; sinon midi le jour indiqué.
        paidAt: date === today() ? undefined : new Date(`${date}T12:00:00`).toISOString(),
      }),
    { success: 'Paiement enregistré : la structure a été prévenue', invalidate: [['platform']], onSuccess: close },
  )
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
          <DialogDescription>
            {invoice && (
              <>
                Facture {invoice.number}
                {(tenantName ?? invoice.tenantName) && ` de ${tenantName ?? invoice.tenantName}`} ({monthLabel(invoice.month)}) :{' '}
                <strong>{formatMoney(invoice.amount, invoice.currency)}</strong>. L’accès est rétabli s’il ne reste aucun impayé.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Moyen de paiement</Label>
            <Select value={method} onValueChange={(v) => v && setMethod(v)}>
              <SelectTrigger className="w-full" aria-label="Moyen de paiement">
                <SelectValue>{(v: string) => paymentMethodLabel[v]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(paymentMethodLabel).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pay-date">Date du paiement</Label>
            <Input id="pay-date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="pay-reference">Référence (transaction, virement…)</Label>
            <Input
              id="pay-reference"
              value={reference}
              maxLength={120}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex. OM-4589213"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Annuler
          </Button>
          <Button disabled={!date || save.isPending} onClick={() => save.mutate(undefined)}>
            Enregistrer le paiement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Annulation motivée : la facture ne compte plus dans les impayés. */
export function VoidDialog({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const close = () => {
    setReason('')
    onClose()
  }
  const save = useApiMutation(() => platformApi.post(`/invoices/${invoice!.id}/void`, { reason: reason.trim() }), {
    success: 'Facture annulée',
    invalidate: [['platform']],
    onSuccess: close,
  })
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Annuler la facture {invoice?.number}</DialogTitle>
          <DialogDescription>
            Erreur de facturation ou geste commercial. L’annulation est définitive et apparaît dans le journal.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="void-reason">Motif</Label>
          <Textarea id="void-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Retour
          </Button>
          <Button variant="destructive" disabled={reason.trim().length < 3 || save.isPending} onClick={() => save.mutate(undefined)}>
            Annuler la facture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
