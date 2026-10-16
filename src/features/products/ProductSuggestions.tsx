import { PACKAGING_NAMES, PRODUCT_UNITS, Role } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import { ImageOff, Loader2, MapPin, Megaphone } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatRelative } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { usePhotoUrl } from '@/lib/use-photo-url'
import { productName, useProducts } from './products'

export interface ProductSuggestion {
  id: string
  name: string
  brand: string | null
  format: string | null
  category: string | null
  note: string | null
  status: 'pending' | 'accepted' | 'rejected'
  photoId: string | null
  createdAt: string
  agentName: string
  outletName: string | null
}

const NEW = 'new'
const NONE = 'none'

const noPhoto = (
  <span className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
    <ImageOff className="size-5" aria-hidden />
  </span>
)

function Thumb({ id, name }: { id: string | null; name: string }) {
  return id ? <PhotoThumb id={id} name={name} /> : noPhoto
}

function PhotoThumb({ id, name }: { id: string; name: string }) {
  const { url, isError } = usePhotoUrl(id)
  if (isError) return noPhoto
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
      <img src={url} alt={`Photo de ${name}`} className="size-16 rounded-md object-cover" />
    </a>
  ) : (
    <span className="size-16 shrink-0 animate-pulse rounded-md bg-muted" />
  )
}

/**
 * Produits concurrents signalés par les agents sur le terrain, à traiter par l'administrateur :
 * ajout au catalogue (fiche pré-remplie) ou rattachement à un produit existant, ou refus motivé.
 */
export function ProductSuggestions() {
  const { user } = useMe()
  const pending = useQuery({
    queryKey: ['product-suggestions', 'pending'],
    queryFn: async () => (await api.get<ProductSuggestion[]>('/product-suggestions', { params: { status: 'pending' } })).data,
  })
  const [accepting, setAccepting] = useState<ProductSuggestion | null>(null)
  const [rejecting, setRejecting] = useState<ProductSuggestion | null>(null)
  const list = pending.data ?? []
  if (!list.length) return null
  const isAdmin = user.role === Role.Admin

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4" aria-label="Produits signalés">
      <div className="flex items-center gap-2">
        <Megaphone className="size-4 text-primary" aria-hidden />
        <h2 className="font-medium">
          {list.length} produit{list.length > 1 ? 's' : ''} concurrent{list.length > 1 ? 's' : ''} signalé{list.length > 1 ? 's' : ''} par
          les agents
        </h2>
      </div>
      <ul className="flex flex-col divide-y rounded-lg border bg-card">
        {list.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 p-3">
            <Thumb id={s.photoId} name={s.name} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{[s.name, s.format].filter(Boolean).join(' ')}</p>
              <p className="text-xs text-muted-foreground">
                {[s.brand, s.category].filter(Boolean).join(' · ')}
                {(s.brand || s.category) && ' · '}
                {s.agentName}, {formatRelative(s.createdAt)}
              </p>
              {s.outletName && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" aria-hidden /> Vu chez {s.outletName}
                </p>
              )}
              {s.note && <p className="mt-1 text-sm">« {s.note} »</p>}
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setRejecting(s)}>
                  Refuser
                </Button>
                <Button size="sm" onClick={() => setAccepting(s)}>
                  Ajouter au catalogue
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <AcceptDialog suggestion={accepting} onClose={() => setAccepting(null)} />
      <RejectDialog suggestion={rejecting} onClose={() => setRejecting(null)} />
    </section>
  )
}

function AcceptDialog({ suggestion, onClose }: { suggestion: ProductSuggestion | null; onClose: () => void }) {
  return (
    <Dialog open={!!suggestion} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {suggestion && <AcceptForm key={suggestion.id} s={suggestion} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function AcceptForm({ s, onClose }: { s: ProductSuggestion; onClose: () => void }) {
  const competitors = useProducts().data?.filter((p) => !p.own) ?? []
  const [target, setTarget] = useState(NEW)
  const [name, setName] = useState(s.name)
  const [brand, setBrand] = useState(s.brand ?? '')
  const [format, setFormat] = useState(s.format ?? '')
  const [category, setCategory] = useState(s.category ?? '')
  const [unit, setUnit] = useState<string>('Bouteille')
  const [packName, setPackName] = useState<string>(NONE)
  const [packUnits, setPackUnits] = useState('')
  const accept = useApiMutation(
    () =>
      api.post(
        `/product-suggestions/${s.id}/accept`,
        target === NEW
          ? {
              name: name.trim(),
              brand: brand.trim() || undefined,
              format: format.trim() || undefined,
              category: category.trim() || undefined,
              unit,
              packagings: packName !== NONE && Number(packUnits) >= 2 ? [{ name: packName, units: Number(packUnits) }] : [],
            }
          : { productId: target },
      ),
    {
      success: target === NEW ? 'Produit ajouté au catalogue' : 'Signalement rattaché au produit',
      invalidate: [['product-suggestions'], ['products']],
      onSuccess: onClose,
    },
  )
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        accept.mutate(undefined)
      }}
    >
      <DialogHeader>
        <DialogTitle>Ajouter « {s.name} » au catalogue</DialogTitle>
        <DialogDescription>
          Il sera ajouté comme produit concurrent : les agents pourront le relever pendant leurs visites.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel>Produit</FieldLabel>
          <Select value={target} onValueChange={(v) => v && setTarget(v)}>
            <SelectTrigger aria-label="Produit">
              <SelectValue>
                {(v: string) =>
                  v === NEW ? 'Nouveau produit concurrent' : `Déjà au catalogue : ${productName(competitors.find((p) => p.id === v) ?? s)}`
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NEW}>Nouveau produit concurrent</SelectItem>
              {competitors.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  Déjà au catalogue : {productName(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {target === NEW && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="sg-name">Nom</FieldLabel>
                <Input id="sg-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
              </Field>
              <Field>
                <FieldLabel htmlFor="sg-format">Format</FieldLabel>
                <Input id="sg-format" value={format} onChange={(e) => setFormat(e.target.value)} placeholder="33 cl" maxLength={40} />
              </Field>
              <Field>
                <FieldLabel htmlFor="sg-brand">Marque</FieldLabel>
                <Input id="sg-brand" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={80} />
              </Field>
              <Field>
                <FieldLabel htmlFor="sg-category">Catégorie</FieldLabel>
                <Input
                  id="sg-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Boissons"
                  maxLength={80}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field>
                <FieldLabel>Unité</FieldLabel>
                <Select value={unit} onValueChange={(v) => v && setUnit(v)}>
                  <SelectTrigger aria-label="Unité">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Conditionnement</FieldLabel>
                <Select value={packName} onValueChange={(v) => v && setPackName(v)}>
                  <SelectTrigger aria-label="Conditionnement">
                    <SelectValue>{(v: string) => (v === NONE ? 'Aucun' : v)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Aucun</SelectItem>
                    {PACKAGING_NAMES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {packName !== NONE && (
                <Field>
                  <FieldLabel htmlFor="sg-units">
                    {unit}s par {packName.toLowerCase()}
                  </FieldLabel>
                  <Input
                    id="sg-units"
                    inputMode="numeric"
                    value={packUnits}
                    onChange={(e) => setPackUnits(e.target.value)}
                    placeholder="12"
                  />
                </Field>
              )}
            </div>
          </>
        )}
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" disabled={(target === NEW && !name.trim()) || accept.isPending}>
          {accept.isPending && <Loader2 className="animate-spin" aria-hidden />}
          {target === NEW ? 'Ajouter au catalogue' : 'Rattacher'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function RejectDialog({ suggestion, onClose }: { suggestion: ProductSuggestion | null; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const reject = useApiMutation(() => api.post(`/product-suggestions/${suggestion!.id}/reject`, { reason: reason.trim() }), {
    success: 'Signalement refusé',
    invalidate: [['product-suggestions']],
    onSuccess: () => {
      setReason('')
      onClose()
    },
  })
  return (
    <Dialog open={!!suggestion} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refuser « {suggestion?.name} » ?</DialogTitle>
          <DialogDescription>L’agent est prévenu avec le motif.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="sg-reason">Motif</FieldLabel>
          <Textarea
            id="sg-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. : déjà au catalogue sous un autre nom"
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Retour
          </Button>
          <Button variant="destructive" disabled={!reason.trim() || reject.isPending} onClick={() => reject.mutate(undefined)}>
            {reject.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Refuser
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
