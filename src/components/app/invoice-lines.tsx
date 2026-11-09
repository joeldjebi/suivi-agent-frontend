import { InvoiceLineKind, type InvoiceLine } from '@suivi/shared'
import { formatMoney, planName } from '@/lib/subscription'
import { cn } from '@/lib/utils'

/** Facture ou estimation, telle que l'API la rend (champs communs). */
export interface BilledMonth {
  planCode?: string
  basePrice: number
  extraAgents: number
  extraAgentPrice: number
  discountPercent: number
  prorataPercent: number
  amount: number
  lines?: InvoiceLine[]
}

/**
 * Lignes d'une facture. Les factures d'avant la grille de novembre 2026 n'ont pas de détail :
 * il est reconstitué (forfait, agents en plus, remise).
 */
export function linesOf(bill: BilledMonth): InvoiceLine[] {
  if (bill.lines?.length) return bill.lines
  const share = (n: number) => Math.round((n * bill.prorataPercent) / 100)
  const lines: InvoiceLine[] = [
    {
      kind: InvoiceLineKind.Plan,
      label: `Formule ${bill.planCode ? planName(bill.planCode) : ''}`.trim(),
      quantity: 1,
      unitPrice: bill.basePrice,
      amount: share(bill.basePrice),
    },
  ]
  if (bill.extraAgents > 0)
    lines.push({
      kind: InvoiceLineKind.ExtraAgents,
      label: 'Agents en plus',
      quantity: bill.extraAgents,
      unitPrice: bill.extraAgentPrice,
      amount: share(bill.extraAgents * bill.extraAgentPrice),
    })
  const subtotal = lines.reduce((s, l) => s + l.amount, 0)
  if (bill.amount !== subtotal)
    lines.push({
      kind: InvoiceLineKind.Discount,
      label: `Remise annuelle de ${bill.discountPercent} %`,
      quantity: 1,
      unitPrice: bill.amount - subtotal,
      amount: bill.amount - subtotal,
    })
  return lines
}

/** Détail ligne par ligne et total (montants à droite, alignés). */
export function InvoiceLines({
  bill,
  currency = 'XOF',
  totalLabel = 'Total',
  className,
}: {
  bill: BilledMonth
  currency?: string
  totalLabel?: string
  className?: string
}) {
  const lines = linesOf(bill)
  return (
    <table className={cn('w-full text-sm', className)}>
      <caption className="sr-only">Détail de la facture</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Ligne</th>
          <th scope="col">Montant</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={i} className="border-b border-dashed last:border-0">
            <td className="py-1.5 pr-3 align-top">
              {l.label}
              {l.quantity > 1 && (
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {l.quantity} × {formatMoney(l.unitPrice, currency)}
                </span>
              )}
            </td>
            <td
              className={cn(
                'py-1.5 text-right align-top whitespace-nowrap tabular-nums',
                l.amount < 0 && 'text-status-active',
              )}
            >
              {formatMoney(l.amount, currency)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t">
          <th scope="row" className="pt-2 text-left font-medium">
            {totalLabel}
          </th>
          <td className="pt-2 text-right font-semibold whitespace-nowrap tabular-nums">
            {formatMoney(bill.amount, currency)}
          </td>
        </tr>
      </tfoot>
    </table>
  )
}
