import { Feature, PAYMENT_METHOD_LABELS, PaymentMethod, Role } from '@suivi/shared'
import { HandCoins, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { formatMoney, useFeature } from '@/lib/subscription'
import { PAYMENT_METHODS, useOutletBalance, type OutletBalance } from './van-sales'

const amountOf = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'))

/**
 * Fiche d'un point de vente (vente en camionnette) : ce qu'il doit, son plafond de crédit
 * (réglé par l'administrateur), ses ventes à régler, et l'encaissement d'un paiement.
 */
export function OutletCredit({ outletId }: { outletId: string }) {
  const enabled = useFeature(Feature.VanSales)
  const { user } = useMe()
  const balance = useOutletBalance(outletId, enabled)
  const [paying, setPaying] = useState(false)
  const [limit, setLimit] = useState<string | null>(null)
  const saveLimit = useApiMutation((value: number | null) => api.put(`/van-sales/outlets/${outletId}/credit-limit`, { limit: value }), {
    success: 'Plafond de crédit enregistré',
    invalidate: [['van-sales', 'balance', outletId]],
    onSuccess: () => setLimit(null),
  })
  if (!enabled || !balance.data) return null
  const b = balance.data
  const isAdmin = user.role === Role.Admin
  return (
    <section className="flex flex-col gap-2" aria-label="Crédit et paiements">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Crédit et paiements</h3>
        {user.role !== Role.Agent && b.outstanding > 0 && (
          <Button size="sm" variant="outline" onClick={() => setPaying(true)}>
            <HandCoins aria-hidden /> Encaisser un paiement
          </Button>
        )}
      </div>
      <dl className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Doit</dt>
          <dd className={`font-semibold tabular-nums ${b.outstanding > 0 ? 'text-status-paused' : ''}`}>{formatMoney(b.outstanding)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Plafond</dt>
          <dd className="font-medium tabular-nums">{b.creditLimit == null ? 'Pas de crédit' : formatMoney(b.creditLimit)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Crédit possible</dt>
          <dd className="font-medium tabular-nums">{b.creditLimit == null ? '—' : formatMoney(b.available)}</dd>
        </div>
        {b.advance > 0 && (
          <p className="col-span-3 text-xs text-muted-foreground">Avance versée, pas encore utilisée : {formatMoney(b.advance)}</p>
        )}
      </dl>
      {isAdmin &&
        (limit == null ? (
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() => setLimit(b.creditLimit == null ? '' : String(b.creditLimit))}
          >
            {b.creditLimit == null ? 'Autoriser le crédit…' : 'Modifier le plafond…'}
          </Button>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <Field className="w-44">
              <FieldLabel htmlFor={`limit-${outletId}`}>Plafond de crédit (FCFA)</FieldLabel>
              <Input
                id={`limit-${outletId}`}
                inputMode="numeric"
                value={limit}
                onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="Ex. : 50000"
              />
            </Field>
            <Button size="sm" disabled={limit === '' || saveLimit.isPending} onClick={() => saveLimit.mutate(amountOf(limit))}>
              Enregistrer
            </Button>
            {b.creditLimit != null && (
              <Button size="sm" variant="outline" disabled={saveLimit.isPending} onClick={() => saveLimit.mutate(null)}>
                Retirer le crédit
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setLimit(null)}>
              Annuler
            </Button>
          </div>
        ))}
      {b.dues.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border text-sm">
          {b.dues.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span>
                {d.reference}
                <span className="block text-xs text-muted-foreground">
                  {formatDate(d.takenAt)} · total {formatMoney(d.total)}
                </span>
              </span>
              <span className="font-medium text-status-paused tabular-nums">reste {formatMoney(d.due)}</span>
            </li>
          ))}
        </ul>
      )}
      {paying && <PaymentDialog balance={b} onClose={() => setPaying(false)} />}
    </section>
  )
}

/** Paiement reçu du client : il règle ses ventes dues, les plus anciennes d'abord. */
function PaymentDialog({ balance, onClose }: { balance: OutletBalance; onClose: () => void }) {
  const [amount, setAmount] = useState(String(balance.outstanding))
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.Cash)
  const value = amountOf(amount)
  const pay = useApiMutation(
    () => api.post('/van-sales/payments', { clientId: crypto.randomUUID(), outletId: balance.outletId, amount: value, method }),
    { success: 'Paiement enregistré', invalidate: [['van-sales'], ['orders']], onSuccess: onClose },
  )
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Paiement de {balance.outletName}</DialogTitle>
          <DialogDescription>
            Il règle ses ventes dues, les plus anciennes d’abord. Doit : {formatMoney(balance.outstanding)}.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="payment-amount">Montant reçu (FCFA)</FieldLabel>
          <Input
            id="payment-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="payment-method">Moyen de paiement</FieldLabel>
          <Select value={method} onValueChange={(v) => v && setMethod(v as PaymentMethod)}>
            <SelectTrigger id="payment-method" className="w-full">
              <SelectValue>{(v: string) => PAYMENT_METHOD_LABELS[v as PaymentMethod]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!(value > 0) || value > balance.outstanding || pay.isPending} onClick={() => pay.mutate(undefined)}>
            {pay.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Enregistrer le paiement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
