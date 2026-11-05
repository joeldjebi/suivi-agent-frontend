import { STOCK_MOVEMENT_KIND_LABELS, StockMovementKind } from '@suivi/shared'
import { History } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { PeriodPicker } from '@/components/app/period-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/format'
import { usePeriod } from '@/lib/period'
import { locationLabel, MovementLines, movementRoute, MovementStatusPill } from './stock-ui'
import { useLocations, useMovements } from './van-sales'

const ALL = 'tous'
const PAGE_SIZE = 25

/** Historique de chaque entrée et sortie de stock, filtrable par type et par emplacement. */
export function MovementsPage() {
  const period = usePeriod()
  const locations = useLocations()
  const [kind, setKind] = useState<StockMovementKind | typeof ALL>(ALL)
  const [locationId, setLocationId] = useState(ALL)
  const [page, setPage] = useState(1)
  const movements = useMovements({
    from: period.from,
    to: period.to,
    kind: kind === ALL ? undefined : kind,
    locationId: locationId === ALL ? undefined : locationId,
    page,
    limit: PAGE_SIZE,
  })
  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setPage(1)
    }
  return (
    <Page>
      <PageHeader
        title="Mouvements de stock"
        description="Chaque entrée, chargement, vente, retour, casse et inventaire : qui, quand, combien, et les écarts constatés."
      />
      <div className="flex flex-wrap items-end gap-3">
        <PeriodPicker period={period} />
        <Select value={kind} onValueChange={(v) => reset(setKind)((v ?? ALL) as StockMovementKind | typeof ALL)}>
          <SelectTrigger className="w-48" aria-label="Type de mouvement">
            <SelectValue>
              {(v: string) => (v === ALL ? 'Tous les mouvements' : STOCK_MOVEMENT_KIND_LABELS[v as StockMovementKind])}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les mouvements</SelectItem>
            {Object.values(StockMovementKind).map((k) => (
              <SelectItem key={k} value={k}>
                {STOCK_MOVEMENT_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={locationId} onValueChange={(v) => reset(setLocationId)(v ?? ALL)}>
          <SelectTrigger className="w-56" aria-label="Dépôt ou camion">
            <SelectValue>
              {(v: string) => (v === ALL ? 'Tous les dépôts et camions' : locationLabel(locations.data?.find((l) => l.id === v)))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les dépôts et camions</SelectItem>
            {(locations.data ?? []).map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {locationLabel(l)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <QueryState query={movements}>
        {!movements.data?.items.length ? (
          <EmptyState icon={History} title="Aucun mouvement" description="Aucun mouvement de stock sur cette période avec ces filtres." />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Mouvement</TableHead>
                    <TableHead className="min-w-64">Produits</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.data.items.map((m) => (
                    <TableRow key={m.id} className="align-top">
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDateTime(m.occurredAt)}
                        {m.createdByName && <span className="block text-xs text-muted-foreground">{m.createdByName}</span>}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <span className="font-medium">{m.label}</span>
                        <span className="block text-xs text-muted-foreground">{movementRoute(m)}</span>
                        {m.note && <span className="block text-xs text-muted-foreground">« {m.note} »</span>}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <MovementLines movement={m} />
                      </TableCell>
                      <TableCell>
                        <MovementStatusPill status={m.status} />
                        {m.confirmedByName && m.status !== 'pending' && (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {m.status === 'cancelled' ? 'Annulé' : 'Confirmé'} par {m.confirmedByName}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              page={page}
              pages={Math.ceil(movements.data.total / PAGE_SIZE)}
              total={movements.data.total}
              pageSize={PAGE_SIZE}
              onPage={setPage}
            />
          </div>
        )}
      </QueryState>
    </Page>
  )
}
