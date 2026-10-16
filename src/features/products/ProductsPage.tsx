import { PACKAGING_NAMES, PRODUCT_UNITS, Role } from '@suivi/shared'
import { CircleSlash, FileUp, Loader2, MoreHorizontal, Package, PenLine, Plus, RotateCcw, Swords, Trash2, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { ImportDialog } from '@/components/app/import-dialog'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { SearchInput } from '@/components/app/search-input'
import { StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { useApiMutation } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { ProductSuggestions } from './ProductSuggestions'
import { productName, useProducts, type Product } from './products'

type Side = 'all' | 'own' | 'competitor'

/**
 * Catalogue de produits : ceux de la structure et ceux de la concurrence, avec leur unité de
 * base et leurs conditionnements (casier, carton…). Les agents les relèvent pendant les visites.
 */
export function ProductsPage() {
  const { user } = useMe()
  const isAdmin = user.role === Role.Admin
  const [side, setSide] = useState<Side>('all')
  const [q, setQ] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<Product | null | undefined>(undefined)
  const [importing, setImporting] = useState(false)
  const [removing, setRemoving] = useState<Product | null>(null)
  const query = useProducts(showInactive)
  const all = query.data ?? []
  const needle = q.trim().toLowerCase()
  const shown = all.filter(
    (p) =>
      (side === 'all' || (side === 'own') === p.own) &&
      (!needle || [p.name, p.brand, p.category, p.format].some((t) => t?.toLowerCase().includes(needle))),
  )
  const counts = { own: all.filter((p) => p.own).length, competitor: all.filter((p) => !p.own).length }
  const toggle = useApiMutation((p: Product) => api.patch(`/products/${p.id}`, { isActive: !p.isActive }), {
    success: 'Produit mis à jour',
    invalidate: [['products']],
  })

  return (
    <Page>
      <PageHeader
        title="Produits"
        description="Vos produits et ceux de la concurrence, relevés par les agents pendant leurs visites : présence, stock, prix, ventes, pertes."
        actions={
          isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImporting(true)}>
                <FileUp aria-hidden /> Importer
              </Button>
              <Button onClick={() => setEditing(null)}>
                <Plus aria-hidden /> Nouveau produit
              </Button>
            </div>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={side} onValueChange={(v) => setSide(v as Side)}>
          <TabsList>
            <TabsTrigger value="all">Tous ({all.length})</TabsTrigger>
            <TabsTrigger value="own">Nos produits ({counts.own})</TabsTrigger>
            <TabsTrigger value="competitor">Concurrents ({counts.competitor})</TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchInput value={q} onChange={setQ} placeholder="Nom, marque, catégorie" label="Rechercher un produit" className="w-64" />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch size="sm" checked={showInactive} onCheckedChange={setShowInactive} />
          Afficher les produits désactivés
        </label>
      </div>
      <ProductSuggestions />
      <QueryState query={query}>
        {all.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Aucun produit"
            description={
              isAdmin
                ? 'Ajoutez vos produits et ceux de vos concurrents, un par un ou en important une liste Excel.'
                : 'L’administrateur n’a pas encore créé le catalogue.'
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Unité et conditionnements</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((p) => (
                  <TableRow key={p.id} className={cn(!p.isActive && 'text-muted-foreground')}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2 font-medium">
                          {productName(p)}
                          {!p.own && <StatusPill tone="paused" icon={Swords} label="Concurrent" className="h-5" />}
                          {!p.isActive && <StatusPill tone="ended" icon={CircleSlash} label="Désactivé" className="h-5" />}
                        </span>
                        {p.brand && <span className="text-xs text-muted-foreground">{p.brand}</span>}
                      </div>
                    </TableCell>
                    <TableCell>{p.category ?? '—'}</TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1.5 text-sm">
                        <span className="rounded-md bg-muted px-2 py-0.5">{p.unit}</span>
                        {p.packagings.map((pack) => (
                          <span key={pack.name} className="rounded-md border px-2 py-0.5">
                            {pack.name} = {pack.units}
                          </span>
                        ))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${p.name}`} />}>
                            <MoreHorizontal aria-hidden />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditing(p)}>
                              <PenLine aria-hidden /> Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={toggle.isPending} onClick={() => toggle.mutate(p)}>
                              {p.isActive ? <CircleSlash aria-hidden /> : <RotateCcw aria-hidden />}
                              {p.isActive ? 'Désactiver' : 'Réactiver'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setRemoving(p)}>
                              <Trash2 aria-hidden /> Supprimer…
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {shown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Aucun produit ne correspond.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>

      <ProductDialog
        open={editing !== undefined}
        onOpenChange={(o) => !o && setEditing(undefined)}
        product={editing ?? undefined}
        categories={[...new Set(all.map((p) => p.category).filter((c): c is string => !!c))]}
      />
      <RemoveDialog product={removing} onOpenChange={(o) => !o && setRemoving(null)} />
      <ImportDialog
        open={importing}
        onOpenChange={setImporting}
        title="Importer des produits"
        description="Une ligne par produit, avec son unité de base et jusqu’à trois conditionnements (ex. « Casier » et « 12 »). Indiquez « Oui » dans la colonne Concurrent pour les produits de la concurrence."
        url="/products/import"
        templateFilename="modele-produits.xlsx"
        invalidate={[['products']]}
        noun={{ one: 'produit', many: 'produits', added: 'ajouté', addedMany: 'ajoutés' }}
        hint="Colonnes reconnues : Nom, Marque, Catégorie, Format, Concurrent, Unité, Conditionnement 1 à 3 et Unités 1 à 3."
      />
    </Page>
  )
}

interface DraftPack {
  name: string
  units: string
}

/** Création ou modification d'un produit, avec ses conditionnements. */
function ProductDialog({
  open,
  onOpenChange,
  product,
  categories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product
  categories: string[]
}) {
  const id = useId()
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [format, setFormat] = useState('')
  const [own, setOwn] = useState(true)
  const [unit, setUnit] = useState('Unité')
  const [packs, setPacks] = useState<DraftPack[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setName(product?.name ?? '')
    setBrand(product?.brand ?? '')
    setCategory(product?.category ?? '')
    setFormat(product?.format ?? '')
    setOwn(product?.own ?? true)
    setUnit(product?.unit ?? 'Unité')
    setPacks((product?.packagings ?? []).map((p) => ({ name: p.name, units: String(p.units) })))
    setError(null)
  }, [open, product])

  const save = useApiMutation(
    () => {
      const body = {
        name: name.trim(),
        brand: brand.trim() || null,
        category: category.trim() || null,
        format: format.trim() || null,
        own,
        unit: unit.trim(),
        packagings: packs.map((p) => ({ name: p.name.trim(), units: Number(p.units) })),
      }
      return product ? api.patch(`/products/${product.id}`, body) : api.post('/products', body)
    },
    { success: product ? 'Produit mis à jour' : 'Produit ajouté', invalidate: [['products']], onSuccess: () => onOpenChange(false) },
  )
  const submit = () => {
    if (!name.trim()) return setError('Donnez un nom au produit.')
    if (!unit.trim()) return setError('Indiquez l’unité de base (bouteille, sachet, kg…).')
    if (packs.some((p) => !p.name.trim() || !Number.isInteger(Number(p.units)) || Number(p.units) < 2))
      return setError('Chaque conditionnement a un nom et contient au moins 2 unités.')
    setError(null)
    save.mutate(undefined)
  }
  const unitWord = unit.trim().toLowerCase() || 'unités'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? 'Modifier le produit' : 'Nouveau produit'}</DialogTitle>
          <DialogDescription>
            Les quantités relevées sont comptées en unités de base ; l’agent peut les saisir en conditionnements.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Produit">
            {(
              [
                [true, 'Notre produit', 'Vendu par votre structure.'],
                [false, 'Concurrent', 'Pour suivre la concurrence.'],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={own === value}
                onClick={() => setOwn(value)}
                className={cn(
                  'flex flex-col items-start gap-0.5 rounded-md border p-3 text-left text-sm hover:bg-muted/50',
                  own === value && 'border-primary bg-primary/5 ring-1 ring-primary',
                )}
              >
                <span className="font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">{hint}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Field>
              <FieldLabel htmlFor={`${id}-name`}>Nom</FieldLabel>
              <Input id={`${id}-name`} autoFocus placeholder="Ex. : Coca-Cola" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-format`}>Format</FieldLabel>
              <Input id={`${id}-format`} placeholder="33 cl" value={format} onChange={(e) => setFormat(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-brand`}>Marque</FieldLabel>
              <Input id={`${id}-brand`} value={brand} onChange={(e) => setBrand(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-category`}>Catégorie</FieldLabel>
              <Input
                id={`${id}-category`}
                list={`${id}-categories`}
                placeholder="Boissons"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <datalist id={`${id}-categories`}>
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor={`${id}-unit`}>Unité de base</FieldLabel>
            <Input id={`${id}-unit`} list={`${id}-units`} value={unit} onChange={(e) => setUnit(e.target.value)} className="w-48" />
            <datalist id={`${id}-units`}>
              {PRODUCT_UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <FieldDescription>Ce que l’on compte à l’unité : bouteille, sachet, pièce, kg…</FieldDescription>
          </Field>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Conditionnements</p>
              <Button
                size="sm"
                variant="outline"
                disabled={packs.length >= 5}
                onClick={() => setPacks((l) => [...l, { name: '', units: '' }])}
              >
                <Plus aria-hidden /> Ajouter
              </Button>
            </div>
            {packs.length === 0 && (
              <p className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">
                Aucun : les quantités se comptent seulement à l’unité.
              </p>
            )}
            {packs.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  aria-label={`Nom du conditionnement ${i + 1}`}
                  list={`${id}-packs`}
                  placeholder="Casier"
                  value={p.name}
                  onChange={(e) => setPacks((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">=</span>
                <Input
                  aria-label={`Unités du conditionnement ${i + 1}`}
                  inputMode="numeric"
                  placeholder="12"
                  value={p.units}
                  onChange={(e) => setPacks((l) => l.map((x, j) => (j === i ? { ...x, units: e.target.value } : x)))}
                  className="w-20"
                />
                <span className="w-20 truncate text-sm text-muted-foreground">{unitWord}</span>
                <Button variant="ghost" size="icon-sm" aria-label="Retirer" onClick={() => setPacks((l) => l.filter((_, j) => j !== i))}>
                  <X aria-hidden />
                </Button>
              </div>
            ))}
            <datalist id={`${id}-packs`}>
              {PACKAGING_NAMES.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RemoveDialog({ product, onOpenChange }: { product: Product | null; onOpenChange: (open: boolean) => void }) {
  const remove = useApiMutation(() => api.delete(`/products/${product!.id}`), {
    success: 'Produit supprimé',
    invalidate: [['products']],
    onSuccess: () => onOpenChange(false),
  })
  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer « {product?.name} » ?</DialogTitle>
          <DialogDescription>
            Possible seulement si le produit n’a jamais été relevé. Sinon, désactivez-le : il disparaît des formulaires et son historique
            est conservé.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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
