import type { Packaging } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import { Loader2, MoreHorizontal, Package, PenLine, Plus, Star, Tags, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { useApiMutation } from '@/lib/queries'
import { formatMoney } from '@/lib/subscription'
import { productName } from '../products/products'
import { usePriceLists, type PriceList } from './orders'

interface PriceRow {
  id: string
  name: string
  format: string | null
  category: string | null
  unit: string
  packagings: Packaging[]
  /** Prix par type de client */
  prices: Record<string, number>
}

interface PriceGrid {
  currency: string
  priceLists: PriceList[]
  products: PriceRow[]
}

/** Clé d'une case de la grille. */
const cell = (listId: string, productId: string) => `${listId}:${productId}`

/** « 1 500 » → 1500 ; vide → null ; illisible → undefined. */
function parsePrice(text: string): number | null | undefined {
  const t = text.replace(/\s/g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/**
 * Types de client (Grossiste, Détaillant…) et prix de vente de nos produits pour chacun. Les
 * agents prennent les commandes à ces prix, selon le type de client du point de vente.
 */
export function PricesPage() {
  const lists = usePriceLists()
  const grid = useQuery({
    queryKey: ['orders', 'prices'],
    queryFn: async () => (await api.get<PriceGrid>('/orders/prices')).data,
  })
  const [editing, setEditing] = useState<PriceList | null | undefined>(undefined)
  const [removing, setRemoving] = useState<PriceList | null>(null)
  // Cases modifiées, pas encore enregistrées.
  const [draft, setDraft] = useState<Record<string, string>>({})
  const data = grid.data
  const original = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of data?.products ?? []) for (const [listId, price] of Object.entries(p.prices)) map[cell(listId, p.id)] = String(price)
    return map
  }, [data])
  const changed = Object.entries(draft).filter(([k, v]) => (original[k] ?? '') !== v.trim())
  const invalid = changed.some(([, v]) => parsePrice(v) === undefined)
  const save = useApiMutation(
    () =>
      api.put('/orders/prices', {
        items: changed.map(([k, v]) => {
          const [priceListId, productId] = k.split(':')
          return { priceListId, productId, price: parsePrice(v) }
        }),
      }),
    { success: 'Prix enregistrés', invalidate: [['orders']], onSuccess: () => setDraft({}) },
  )
  const setDefault = useApiMutation((l: PriceList) => api.patch(`/orders/price-lists/${l.id}`, { isDefault: true }), {
    success: 'Type de client par défaut changé',
    invalidate: [['orders']],
  })

  return (
    <Page>
      <PageHeader
        title="Types de client et prix"
        description="Créez vos types de client (Grossiste, Détaillant…) et fixez le prix de chaque produit pour chacun. Un point de vente sans type de client a les prix du type par défaut."
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus aria-hidden /> Nouveau type de client
          </Button>
        }
      />
      <QueryState query={lists} rows={1}>
        {!lists.data?.length ? (
          <EmptyState
            icon={Tags}
            title="Aucun type de client"
            description="Commencez par « Détaillant » par exemple : il s’appliquera par défaut à tous vos points de vente."
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {lists.data.map((l) => (
              <div key={l.id} className="flex items-center gap-1 rounded-lg border bg-card py-1 pr-1 pl-3 text-sm">
                <span className="font-medium">{l.name}</span>
                {l.isDefault && (
                  <Badge variant="secondary">
                    <Star className="size-3" aria-hidden /> Par défaut
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {l.isDefault ? 'tous les points de vente sans type' : `${l.outlets} point${l.outlets > 1 ? 's' : ''} de vente`}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions sur ${l.name}`} />}>
                    <MoreHorizontal aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(l)}>
                      <PenLine aria-hidden /> Renommer
                    </DropdownMenuItem>
                    {!l.isDefault && (
                      <>
                        <DropdownMenuItem onClick={() => setDefault.mutate(l)}>
                          <Star aria-hidden /> Utiliser par défaut
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => setRemoving(l)}>
                          <Trash2 aria-hidden /> Supprimer…
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </QueryState>

      {!!lists.data?.length && (
        <QueryState query={grid}>
          {data &&
            (!data.products.length ? (
              <EmptyState
                icon={Package}
                title="Aucun produit à vendre"
                description="Ajoutez vos produits au catalogue (Points de vente → Produits) pour leur fixer un prix."
                action={
                  <Button variant="outline" nativeButton={false} render={<Link to="/products" />}>
                    Ouvrir le catalogue
                  </Button>
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                <div className="overflow-x-auto rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        {data.priceLists.map((l) => (
                          <TableHead key={l.id} className="min-w-36">
                            {l.name}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.products.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <span className="block font-medium">{productName(p)}</span>
                            <span className="text-xs text-muted-foreground">
                              Prix par {p.unit.toLowerCase()}
                              {p.packagings.length > 0 &&
                                ` · ${p.packagings.map((k) => `${k.name.toLowerCase()} de ${k.units}`).join(', ')}`}
                            </span>
                          </TableCell>
                          {data.priceLists.map((l) => {
                            const key = cell(l.id, p.id)
                            const value = draft[key] ?? original[key] ?? ''
                            const bad = parsePrice(value) === undefined
                            const n = parsePrice(value)
                            const pack = p.packagings.at(-1)
                            return (
                              <TableCell key={l.id}>
                                <Input
                                  inputMode="decimal"
                                  aria-label={`Prix de ${productName(p)} pour ${l.name}`}
                                  aria-invalid={bad || undefined}
                                  placeholder="Non vendu"
                                  value={value}
                                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                                  className="h-8 w-32 tabular-nums"
                                />
                                {n != null && pack && (
                                  <span className="mt-1 block text-[11px] text-muted-foreground">
                                    {pack.name} : {formatMoney(n * pack.units, data.currency)}
                                  </span>
                                )}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <span className="text-sm text-muted-foreground">
                    {invalid
                      ? 'Un prix est illisible : un nombre, sans lettres.'
                      : changed.length
                        ? `${changed.length} prix modifié${changed.length > 1 ? 's' : ''}`
                        : 'Laissez une case vide si le produit n’est pas vendu à ce type de client.'}
                  </span>
                  {changed.length > 0 && (
                    <Button variant="outline" onClick={() => setDraft({})}>
                      Annuler
                    </Button>
                  )}
                  <Button disabled={!changed.length || invalid || save.isPending} onClick={() => save.mutate(undefined)}>
                    {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
                    Enregistrer les prix
                  </Button>
                </div>
              </div>
            ))}
        </QueryState>
      )}

      <PriceListDialog list={editing} onClose={() => setEditing(undefined)} />
      <RemovePriceListDialog list={removing} onClose={() => setRemoving(null)} />
    </Page>
  )
}

/** Nouveau type de client (null) ou renommage. */
function PriceListDialog({ list, onClose }: { list: PriceList | null | undefined; onClose: () => void }) {
  const open = list !== undefined
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{open && <PriceListForm key={list?.id ?? 'new'} list={list} onClose={onClose} />}</DialogContent>
    </Dialog>
  )
}

function PriceListForm({ list, onClose }: { list: PriceList | null; onClose: () => void }) {
  const [name, setName] = useState(list?.name ?? '')
  const save = useApiMutation(
    () =>
      list ? api.patch(`/orders/price-lists/${list.id}`, { name: name.trim() }) : api.post('/orders/price-lists', { name: name.trim() }),
    { success: list ? 'Type de client renommé' : 'Type de client créé', invalidate: [['orders'], ['outlets']], onSuccess: onClose },
  )
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) save.mutate(undefined)
      }}
    >
      <DialogHeader>
        <DialogTitle>{list ? 'Renommer le type de client' : 'Nouveau type de client'}</DialogTitle>
        <DialogDescription>Ex. : Grossiste, Demi-grossiste, Détaillant, Supermarché.</DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="price-list-name">Nom</FieldLabel>
        <Input id="price-list-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" disabled={!name.trim() || save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Enregistrer
        </Button>
      </DialogFooter>
    </form>
  )
}

function RemovePriceListDialog({ list, onClose }: { list: PriceList | null; onClose: () => void }) {
  const remove = useApiMutation(() => api.delete(`/orders/price-lists/${list!.id}`), {
    success: 'Type de client supprimé',
    invalidate: [['orders'], ['outlets']],
    onSuccess: onClose,
  })
  return (
    <Dialog open={!!list} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer « {list?.name} » ?</DialogTitle>
          <DialogDescription>
            {list?.outlets
              ? `Ses ${list.outlets} point(s) de vente passeront au type de client par défaut et à ses prix.`
              : 'Ses prix seront supprimés.'}{' '}
            Les commandes déjà prises gardent leurs prix.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(undefined)}>
            {remove.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
