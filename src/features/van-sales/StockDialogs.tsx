import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { useApiMutation } from '@/lib/queries'
import { formatQuantity, useProducts } from '../products/products'
import { emptyLine, LinesEditor, linesBody, LocationSelect, MovementLines, movementRoute, type LineDraft } from './stock-ui'
import { useStockLevels, type StockLocation, type StockMovement } from './van-sales'

export type StockAction = 'receipt' | 'load' | 'loss' | 'inventory'

const TEXT: Record<StockAction, { title: string; description: string; submit: string; success: string }> = {
  receipt: {
    title: 'Entrée au dépôt',
    description: 'Marchandise reçue au dépôt (livraison du fournisseur, production). Le stock du dépôt augmente aussitôt.',
    submit: 'Enregistrer l’entrée',
    success: 'Entrée enregistrée',
  },
  load: {
    title: 'Charger un camion',
    description: 'Le stock bouge quand l’agent confirme la réception sur son téléphone (il peut signaler un écart).',
    submit: 'Préparer le chargement',
    success: 'Chargement préparé : l’agent est prévenu',
  },
  loss: {
    title: 'Casse ou perte',
    description: 'Produits cassés, perdus, volés ou périmés : ils sortent du stock. Le motif est obligatoire.',
    submit: 'Enregistrer la sortie',
    success: 'Sortie enregistrée',
  },
  inventory: {
    title: 'Inventaire',
    description: 'Saisissez ce que vous avez compté : le stock prend ces quantités, et l’écart est enregistré.',
    submit: 'Valider l’inventaire',
    success: 'Inventaire enregistré',
  },
}

/** Entrée au dépôt, chargement d'un camion, casse ou perte, inventaire. */
export function StockActionDialog({
  action,
  onClose,
  locations,
  locationId,
}: {
  action: StockAction
  onClose: () => void
  locations: StockLocation[]
  /** Emplacement présélectionné */
  locationId?: string
}) {
  const products = useProducts()
  const own = useMemo(() => (products.data ?? []).filter((p) => p.own && p.isActive), [products.data])
  const depots = locations.filter((l) => l.kind === 'depot' && l.isActive)
  const vans = locations.filter((l) => l.kind === 'van' && l.isActive)
  const preset = locations.find((l) => l.id === locationId)
  const [depotId, setDepotId] = useState(preset?.kind === 'depot' ? preset.id : depots.length === 1 ? depots[0].id : '')
  const [vanId, setVanId] = useState(preset?.kind === 'van' ? preset.id : '')
  const [placeId, setPlaceId] = useState(preset?.id ?? '')
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()])
  const [note, setNote] = useState('')
  const t = TEXT[action]

  // Stock de l'emplacement d'où part la marchandise (ou compté).
  const source = action === 'load' ? depotId : action === 'loss' || action === 'inventory' ? placeId : ''
  const levels = useStockLevels(source || undefined)
  const available = useMemo(
    () => (source && levels.data ? Object.fromEntries(levels.data.products.map((p) => [p.id, p.quantities[source] ?? 0])) : undefined),
    [levels.data, source],
  )
  // Inventaire : une ligne par produit, préremplie avec le stock connu ; seules les saisies sont gardées.
  const [edits, setEdits] = useState<Record<string, string>>({})
  const counted = (productId: string) => edits[productId] ?? String(available?.[productId] ?? 0)

  const body = linesBody(lines, own)
  const save = useApiMutation(
    async () => {
      if (action === 'receipt') return api.post('/stock/receipts', { depotId, lines: body, note: note.trim() || undefined })
      if (action === 'load') return api.post('/stock/loads', { depotId, vanId, lines: body, note: note.trim() || undefined })
      if (action === 'loss')
        return api.post('/stock/losses', { clientId: crypto.randomUUID(), locationId: placeId, lines: body, note: note.trim() })
      return api.post<{ differences: number }>('/stock/inventories', {
        locationId: placeId,
        note: note.trim() || undefined,
        lines: own
          .map((p) => ({ productId: p.id, value: counted(p.id) }))
          .filter((l) => l.value !== '')
          .map((l) => ({ productId: l.productId, counted: Number(l.value.replace(',', '.')) })),
      })
    },
    { success: t.success, invalidate: [['stock'], ['van-sales']], onSuccess: onClose },
  )
  const valid =
    action === 'receipt'
      ? !!depotId && body.length > 0
      : action === 'load'
        ? !!depotId && !!vanId && body.length > 0
        : action === 'loss'
          ? !!placeId && body.length > 0 && !!note.trim()
          : !!placeId && !!available && own.length > 0

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {(action === 'receipt' || action === 'load') && (
            <Field>
              <FieldLabel htmlFor="stock-depot">{action === 'load' ? 'Depuis le dépôt' : 'Dépôt'}</FieldLabel>
              <LocationSelect id="stock-depot" value={depotId} onChange={setDepotId} locations={depots} placeholder="Choisir un dépôt" />
            </Field>
          )}
          {action === 'load' && (
            <Field>
              <FieldLabel htmlFor="stock-van">Camion</FieldLabel>
              <LocationSelect id="stock-van" value={vanId} onChange={setVanId} locations={vans} placeholder="Choisir un camion" />
            </Field>
          )}
          {(action === 'loss' || action === 'inventory') && (
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="stock-place">Dépôt ou camion</FieldLabel>
              <LocationSelect
                id="stock-place"
                value={placeId}
                onChange={setPlaceId}
                locations={locations.filter((l) => l.isActive)}
                placeholder="Choisir"
              />
            </Field>
          )}
        </div>

        {action === 'inventory' ? (
          placeId && (
            <div className="flex flex-col divide-y rounded-lg border">
              {own.map((p) => {
                const known = available?.[p.id] ?? 0
                const value = counted(p.id)
                const diff = value === '' ? 0 : Number(value.replace(',', '.')) - known
                return (
                  <label key={p.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {p.name} {p.format}
                      </span>
                      <span className="text-xs text-muted-foreground">Connu : {formatQuantity(known, p)}</span>
                    </span>
                    <Input
                      className="w-28"
                      inputMode="decimal"
                      aria-label={`Compté : ${p.name}`}
                      value={value}
                      onChange={(e) => setEdits({ ...edits, [p.id]: e.target.value.replace(/[^\d.,]/g, '') })}
                    />
                    <span className={`w-20 text-right text-xs tabular-nums ${diff ? 'text-status-alert' : 'text-muted-foreground'}`}>
                      {diff ? `${diff > 0 ? '+' : ''}${diff.toLocaleString('fr-FR')}` : '='}
                    </span>
                  </label>
                )
              })}
            </div>
          )
        ) : (
          <LinesEditor lines={lines} onChange={setLines} products={own} available={available} />
        )}

        <Field>
          <FieldLabel htmlFor="stock-note">{action === 'loss' ? 'Motif' : 'Note (facultatif)'}</FieldLabel>
          <Textarea
            id="stock-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={action === 'loss' ? 'Ex. : casier tombé du camion' : undefined}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate(undefined)}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            {t.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Confirmation d'un chargement ou d'un retour, avec les quantités réellement reçues. */
export function ConfirmMovementDialog({ movement, onClose }: { movement: StockMovement; onClose: () => void }) {
  const [received, setReceived] = useState<Record<string, string>>(() =>
    Object.fromEntries(movement.lines.map((l) => [l.productId, String(l.quantity)])),
  )
  const [note, setNote] = useState('')
  const confirm = useApiMutation(
    () =>
      api.post(`/stock/movements/${movement.id}/confirm`, {
        note: note.trim() || undefined,
        lines: movement.lines.map((l) => ({ productId: l.productId, received: Number((received[l.productId] || '0').replace(',', '.')) })),
      }),
    { success: 'Réception confirmée : le stock est à jour', invalidate: [['stock'], ['van-sales']], onSuccess: onClose },
  )
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirmer : {movement.label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            {movementRoute(movement)}. Corrigez une quantité si tout n’est pas arrivé : l’écart reste visible dans l’historique.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col divide-y rounded-lg border">
          {movement.lines.map((l) => (
            <label key={l.productId} className="flex items-center gap-2 p-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{l.name}</span>
                <span className="text-xs text-muted-foreground">Envoyé : {formatQuantity(l.quantity, l)}</span>
              </span>
              <Input
                className="w-28"
                inputMode="decimal"
                aria-label={`Reçu : ${l.name}`}
                value={received[l.productId] ?? ''}
                onChange={(e) => setReceived({ ...received, [l.productId]: e.target.value.replace(/[^\d.,]/g, '') })}
              />
            </label>
          ))}
        </div>
        <Field>
          <FieldLabel htmlFor="confirm-note">Note (facultatif)</FieldLabel>
          <Input id="confirm-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : 2 bouteilles cassées" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Retour
          </Button>
          <Button disabled={confirm.isPending} onClick={() => confirm.mutate(undefined)}>
            {confirm.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Confirmer la réception
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Annulation d'un chargement ou d'un retour en attente (motif obligatoire). */
export function CancelMovementDialog({ movement, onClose }: { movement: StockMovement; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const cancel = useApiMutation(() => api.post(`/stock/movements/${movement.id}/cancel`, { reason: reason.trim() }), {
    success: 'Mouvement annulé',
    invalidate: [['stock'], ['van-sales']],
    onSuccess: onClose,
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler : {movement.label.toLowerCase()} ?</DialogTitle>
          <DialogDescription>Le stock ne bouge pas. L’agent voit le motif.</DialogDescription>
        </DialogHeader>
        <MovementLines movement={movement} />
        <Field>
          <FieldLabel htmlFor="cancel-movement">Motif</FieldLabel>
          <Textarea id="cancel-movement" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. : camion en panne" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Retour
          </Button>
          <Button variant="destructive" disabled={!reason.trim() || cancel.isPending} onClick={() => cancel.mutate(undefined)}>
            {cancel.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Annuler le mouvement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
