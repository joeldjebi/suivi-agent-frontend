import { useQuery } from '@tanstack/react-query'
import { Link2, Plus, Presentation as PresentationIcon, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import type { Presentation, PresentationContent } from '@/presentation/types'
import { platformApi } from '../api'
import { to } from '../config'
import type { Paged, TenantRow } from '../types'

const NEW_CLIENT = 'new'

/** Présentations clients : une par prospect ou client, générée à partir de ses informations. */
export function PresentationsPage() {
  const [creating, setCreating] = useState(false)
  const [removing, setRemoving] = useState<Presentation | null>(null)
  const query = useQuery({
    queryKey: ['platform', 'presentations'],
    queryFn: async () => (await platformApi.get<Presentation[]>('/presentations')).data,
  })
  const remove = useApiMutation((id: string) => platformApi.delete(`/presentations/${id}`), {
    success: 'Présentation supprimée',
    invalidate: [['platform', 'presentations']],
    onSuccess: () => setRemoving(null),
  })

  return (
    <Page>
      <PageHeader
        title="Présentations clients"
        description="Diaporama, fiches à imprimer, déroulé de la démo et liste de démarrage, générés à partir des informations du client."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden /> Nouvelle présentation
          </Button>
        }
      />
      <QueryState query={query}>
        {query.data?.length ? (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Structure</TableHead>
                  <TableHead>Lien de partage</TableHead>
                  <TableHead>Modifiée</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <Link to={to(`/presentations/${p.id}`)} className="hover:underline">
                        {p.content.clientName}
                      </Link>
                      {p.content.trade && <p className="text-xs font-normal text-muted-foreground">{p.content.trade}</p>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.tenantName ?? 'Nouveau client'}</TableCell>
                    <TableCell>
                      {p.shareToken ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <Link2 className="size-3.5 text-primary" aria-hidden />
                          Partagée · {p.viewCount} ouverture{p.viewCount > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Non partagée</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(p.updatedAt)}</TableCell>
                    <TableCell>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Supprimer la présentation de ${p.content.clientName}`}
                        onClick={() => setRemoving(p)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState
            icon={PresentationIcon}
            title="Aucune présentation"
            description="Créez la présentation d’un prospect ou d’une structure existante : ses informations remplissent le modèle."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden /> Nouvelle présentation
              </Button>
            }
          />
        )}
      </QueryState>

      {creating && <CreateDialog onClose={() => setCreating(false)} />}

      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer la présentation de {removing?.content.clientName} ?</DialogTitle>
            <DialogDescription>
              Suppression définitive. {removing?.shareToken ? 'Le lien de partage ne fonctionnera plus.' : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Annuler
            </Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => removing && remove.mutate(removing.id)}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

/** Nouveau prospect (nom saisi) ou structure existante (informations pré-remplies). */
function CreateDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [tenantId, setTenantId] = useState(NEW_CLIENT)
  const [clientName, setClientName] = useState('')
  const tenants = useQuery({
    queryKey: ['platform', 'tenants', 'choices'],
    queryFn: async () => (await platformApi.get<Paged<TenantRow>>('/tenants', { params: { limit: 100 } })).data.items,
  })
  const existing = tenantId !== NEW_CLIENT
  const create = useApiMutation(
    async () => {
      const params = existing ? { tenantId } : {}
      const defaults = (await platformApi.get<PresentationContent>('/presentations/defaults', { params })).data
      const content = existing ? defaults : { ...defaults, clientName: clientName.trim() }
      return (await platformApi.post<Presentation>('/presentations', { content, tenantId: existing ? tenantId : null })).data
    },
    {
      invalidate: [['platform', 'presentations']],
      onSuccess: (created) => void navigate(to(`/presentations/${created.id}`)),
    },
  )
  const valid = existing || clientName.trim().length >= 2

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle présentation</DialogTitle>
          <DialogDescription>
            Pour un client déjà inscrit, ses zones, ses effectifs, ses produits et les fonctions de sa formule sont repris tout seuls.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) create.mutate(undefined)
          }}
        >
          <div className="flex flex-col gap-2">
            <Label id="presentation-tenant">Client</Label>
            <Select value={tenantId} onValueChange={(v) => v && setTenantId(v)}>
              <SelectTrigger className="w-full" aria-labelledby="presentation-tenant">
                <SelectValue>
                  {(v: string) => (v === NEW_CLIENT ? 'Nouveau client (prospect)' : (tenants.data?.find((t) => t.id === v)?.name ?? v))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_CLIENT}>Nouveau client (prospect)</SelectItem>
                {tenants.data?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!existing && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="presentation-name">Nom du client</Label>
              <Input
                id="presentation-name"
                value={clientName}
                maxLength={80}
                autoFocus
                placeholder="Ex. Moyoo Pro"
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={!valid || create.isPending}>
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
