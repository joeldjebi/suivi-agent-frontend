import { Banknote, HandCoins, Loader2, Smartphone, Wallet } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatTime } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { formatMoney } from '@/lib/subscription'
import { useCash, type CashRow } from './van-sales'

const todayLocal = () => new Date().toLocaleDateString('sv-SE')

/**
 * Caisse du jour : ce que chaque agent a vendu et encaissé (espèces, mobile money), ce qui
 * reste dû sur ses ventes, et l'argent liquide qu'il doit remettre. Le responsable enregistre
 * chaque remise.
 */
export function CashPage() {
  const [date, setDate] = useState(todayLocal)
  const cash = useCash({ date })
  const [remitting, setRemitting] = useState<CashRow | null>(null)
  const d = cash.data
  const money = (n: number) => formatMoney(n)
  return (
    <Page>
      <PageHeader
        title="Caisse"
        description="Ventes et encaissements du jour par agent, et l’argent liquide à remettre. Enregistrez chaque remise quand vous recevez l’argent."
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cash-day">Jour</Label>
        <Input
          id="cash-day"
          type="date"
          className="w-44"
          value={date}
          max={todayLocal()}
          onChange={(e) => setDate(e.target.value || todayLocal())}
        />
      </div>
      <QueryState query={cash} rows={4}>
        {d &&
          (d.agents.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Aucune vente ni encaissement"
              description="Les ventes des agents depuis leur camion et les paiements reçus apparaissent ici."
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi icon={HandCoins} label="Ventes du jour" value={money(d.totals.salesAmount)} hint={`${d.totals.salesCount} vente(s)`} />
                <Kpi icon={Banknote} label="Espèces encaissées" value={money(d.totals.cash)} />
                <Kpi icon={Smartphone} label="Mobile money et virements" value={money(d.totals.mobileMoney + d.totals.bank)} />
                <Kpi
                  icon={Wallet}
                  label="Espèces à remettre"
                  value={money(d.totals.cashBalance)}
                  hint={d.totals.dueOnSales ? `${money(d.totals.dueOnSales)} à crédit sur les ventes du jour` : undefined}
                  alert={d.totals.cashBalance > 0}
                />
              </div>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead className="text-right">Ventes</TableHead>
                      <TableHead className="text-right">Espèces</TableHead>
                      <TableHead className="text-right">Mobile money</TableHead>
                      <TableHead className="text-right">À crédit</TableHead>
                      <TableHead className="text-right">Remis ce jour</TableHead>
                      <TableHead className="text-right">À remettre</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.agents.map((a) => (
                      <TableRow key={a.agentId}>
                        <TableCell>
                          <span className="font-medium">{a.agentName}</span>
                          <span className="block text-xs text-muted-foreground">{a.vanName ?? 'Sans camion'}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(a.salesAmount)}
                          <span className="block text-xs text-muted-foreground">{a.salesCount} vente(s)</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{money(a.cash)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(a.mobileMoney + a.bank)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(a.dueOnSales)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(a.remittedToday)}</TableCell>
                        <TableCell className={`text-right font-semibold tabular-nums ${a.cashBalance > 0 ? 'text-status-paused' : ''}`}>
                          {money(a.cashBalance)}
                        </TableCell>
                        <TableCell className="text-right">
                          {a.cashBalance > 0 && (
                            <Button size="sm" variant="outline" onClick={() => setRemitting(a)}>
                              Recevoir
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={8} className="text-xs font-normal text-muted-foreground">
                        « À remettre » : tout l’argent liquide encaissé par l’agent et pas encore remis, jours précédents compris.
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
              {d.remittances.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h2 className="font-semibold">Remises du jour</h2>
                  <ul className="flex flex-col divide-y rounded-lg border bg-card">
                    {d.remittances.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
                        <span className="font-medium tabular-nums">{money(r.amount)}</span>
                        <span>{d.agents.find((a) => a.agentId === r.agentId)?.agentName}</span>
                        <span className="text-muted-foreground">
                          à {formatTime(r.remittedAt)}
                          {r.receivedBy && `, reçu par ${r.receivedBy}`}
                          {r.note && ` · « ${r.note} »`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ))}
      </QueryState>
      {remitting && <RemitDialog row={remitting} onClose={() => setRemitting(null)} />}
    </Page>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  alert,
}: {
  icon: typeof Wallet
  label: string
  value: string
  hint?: string
  alert?: boolean
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden /> {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${alert ? 'text-status-paused' : ''}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Le responsable reçoit l'argent liquide de l'agent. */
function RemitDialog({ row, onClose }: { row: CashRow; onClose: () => void }) {
  const [amount, setAmount] = useState(String(row.cashBalance))
  const [note, setNote] = useState('')
  const value = Number(amount.replace(',', '.'))
  const remit = useApiMutation(
    () => api.post('/van-sales/remittances', { agentId: row.agentId, amount: value, note: note.trim() || undefined }),
    { success: 'Remise enregistrée', invalidate: [['van-sales']], onSuccess: onClose },
  )
  const gap = row.cashBalance - (value || 0)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recevoir l’argent de {row.agentName}</DialogTitle>
          <DialogDescription>Comptez l’argent remis. S’il en manque, l’écart reste à remettre.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="remit-amount">Montant reçu (FCFA)</FieldLabel>
          <Input id="remit-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} />
          <p className="text-xs text-muted-foreground">
            Attendu : {formatMoney(row.cashBalance)}
            {gap > 0 && value > 0 && <span className="text-status-paused"> · reste {formatMoney(gap)} à remettre</span>}
          </p>
        </Field>
        <Field>
          <FieldLabel htmlFor="remit-note">Note (facultatif)</FieldLabel>
          <Input id="remit-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!(value > 0) || value > row.cashBalance || remit.isPending} onClick={() => remit.mutate(undefined)}>
            {remit.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Enregistrer la remise
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
