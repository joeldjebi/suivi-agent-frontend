import { Feature, Role } from '@suivi/shared'
import { ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { formatMoney, useFeature } from '@/lib/subscription'
import type { Outlet } from '../outlets/outlets'
import { OrderSheet, OrderStatusPill } from './OrderSheet'
import { useOrders, usePriceLists } from './orders'

const DEFAULT = 'default'

/**
 * Fiche d'un point de vente (formule avec la prise de commande) : son type de client, qui
 * décide de ses prix, et ses dernières commandes.
 */
export function OutletOrders({ outlet }: { outlet: Outlet }) {
  const enabled = useFeature(Feature.Orders)
  const { user } = useMe()
  const canEdit = user.role !== Role.Agent
  const lists = usePriceLists(enabled)
  const orders = useOrders({ outletId: outlet.id, limit: 5 }, enabled)
  const [open, setOpen] = useState<string | null>(null)
  const save = useApiMutation((priceListId: string | null) => api.patch(`/outlets/${outlet.id}`, { priceListId }), {
    success: 'Type de client enregistré',
    invalidate: [['outlets'], ['orders']],
  })
  if (!enabled) return null
  const fallback = lists.data?.find((l) => l.isDefault)
  const items = orders.data?.items ?? []

  return (
    <section className="flex flex-col gap-2" aria-label="Commandes">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Commandes</h3>
        {orders.data && orders.data.total > items.length && (
          <span className="text-xs text-muted-foreground">{orders.data.total} au total</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-xs text-muted-foreground">Type de client</span>
        {canEdit && lists.data?.length ? (
          <Select value={outlet.priceList?.id ?? DEFAULT} onValueChange={(v) => v && save.mutate(v === DEFAULT ? null : v)}>
            <SelectTrigger size="sm" className="w-52" aria-label="Type de client">
              <SelectValue>
                {(v: string) =>
                  v === DEFAULT ? `Par défaut${fallback ? ` (${fallback.name})` : ''}` : (lists.data?.find((l) => l.id === v)?.name ?? '…')
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT}>Par défaut{fallback ? ` (${fallback.name})` : ''}</SelectItem>
              {lists.data.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span>{outlet.priceList?.name ?? (fallback ? `${fallback.name} (par défaut)` : 'Aucun')}</span>
        )}
        {user.role === Role.Admin && !lists.data?.length && (
          <Link to="/prices" className="text-xs text-primary hover:underline">
            Créer les types de client
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <ShoppingCart className="size-4 shrink-0" aria-hidden /> Pas encore de commande.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {items.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                onClick={() => setOpen(o.id)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {o.reference} · {formatMoney(o.total, o.currency)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDateTime(o.takenAt)} · {o.agentName}
                  </span>
                </span>
                <OrderStatusPill status={o.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <OrderSheet id={open} onOpenChange={(o) => !o && setOpen(null)} />
    </section>
  )
}
