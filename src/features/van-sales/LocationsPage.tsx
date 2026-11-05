import { StockLocationKind } from '@suivi/shared'
import { Loader2, Pencil, Plus, Truck, Warehouse } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { useAgents, useApiMutation } from '@/lib/queries'
import { LocationIcon } from './stock-ui'
import { useLocations, type StockLocation } from './van-sales'

const NONE = 'aucun'

/** Dépôts et camions de la structure ; chaque camion est confié à un agent vendeur. */
export function LocationsPage() {
  const locations = useLocations()
  const [editing, setEditing] = useState<StockLocation | 'depot' | 'van' | null>(null)
  const list = locations.data ?? []
  return (
    <Page>
      <PageHeader
        title="Dépôts et camions"
        description="Le stock vit dans ces emplacements. Chaque camion est confié à un agent : il vend avec le stock de son camion."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setEditing('van')}>
              <Plus aria-hidden /> Nouveau camion
            </Button>
            <Button variant="outline" onClick={() => setEditing('depot')}>
              <Plus aria-hidden /> Nouveau dépôt
            </Button>
          </div>
        }
      />
      <QueryState query={locations}>
        {list.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title="Aucun dépôt ni camion"
            description="Commencez par le dépôt d’où partent les marchandises, puis créez un camion par agent vendeur."
            action={<Button onClick={() => setEditing('depot')}>Créer un dépôt</Button>}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((l) => (
              <li key={l.id} className={`flex items-start gap-3 rounded-lg border bg-card p-4 ${l.isActive ? '' : 'opacity-60'}`}>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <LocationIcon kind={l.kind} className="size-5 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words">
                    {l.name}
                    {!l.isActive && (
                      <Badge variant="outline" className="ml-2">
                        Retiré
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {l.kind === StockLocationKind.Van ? (
                      <>
                        Camion{l.plate && ` · ${l.plate}`}
                        <span className="block">{l.agentName ? `Agent : ${l.agentName}` : 'Aucun agent affecté'}</span>
                      </>
                    ) : (
                      'Dépôt'
                    )}
                  </p>
                </div>
                <Button variant="ghost" size="icon" aria-label={`Modifier ${l.name}`} onClick={() => setEditing(l)}>
                  <Pencil aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      {editing && (
        <LocationDialog
          location={typeof editing === 'string' ? null : editing}
          kind={typeof editing === 'string' ? editing : editing.kind}
          taken={list.filter((l) => l.isActive && l.agentId).map((l) => ({ agentId: l.agentId!, id: l.id, name: l.name }))}
          onClose={() => setEditing(null)}
        />
      )}
    </Page>
  )
}

function LocationDialog({
  location,
  kind,
  taken,
  onClose,
}: {
  location: StockLocation | null
  kind: 'depot' | 'van'
  /** Agents qui ont déjà un camion actif */
  taken: { agentId: string; id: string; name: string }[]
  onClose: () => void
}) {
  const agents = useAgents()
  const [name, setName] = useState(location?.name ?? '')
  const [plate, setPlate] = useState(location?.plate ?? '')
  const [agentId, setAgentId] = useState(location?.agentId ?? NONE)
  const [isActive, setIsActive] = useState(location?.isActive ?? true)
  const isVan = kind === 'van'
  const save = useApiMutation(
    () => {
      const body = {
        name: name.trim(),
        ...(isVan ? { plate: plate.trim() || null, agentId: agentId === NONE ? null : agentId } : {}),
      }
      return location
        ? api.patch<StockLocation>(`/stock/locations/${location.id}`, { ...body, isActive }).then((r) => r.data)
        : api.post<StockLocation>('/stock/locations', { ...body, kind }).then((r) => r.data)
    },
    {
      success: location ? 'Enregistré' : isVan ? 'Camion créé' : 'Dépôt créé',
      invalidate: [['stock']],
      onSuccess: onClose,
    },
  )
  const Icon = isVan ? Truck : Warehouse
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-5" aria-hidden />
            {location ? location.name : isVan ? 'Nouveau camion' : 'Nouveau dépôt'}
          </DialogTitle>
          <DialogDescription>
            {isVan
              ? 'L’agent affecté vend avec le stock de ce camion et confirme ses chargements sur son téléphone.'
              : 'Les camions se chargent depuis ce dépôt et y rapportent leurs invendus.'}
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="location-name">Nom</FieldLabel>
          <Input
            id="location-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder={isVan ? 'Ex. : Camion 1' : 'Ex. : Dépôt Yopougon'}
          />
        </Field>
        {isVan && (
          <>
            <Field>
              <FieldLabel htmlFor="location-plate">Immatriculation (facultatif)</FieldLabel>
              <Input
                id="location-plate"
                value={plate}
                maxLength={20}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="Ex. : AB 1234 CI"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="location-agent">Agent vendeur</FieldLabel>
              <Select value={agentId} onValueChange={(v) => setAgentId(v ?? NONE)}>
                <SelectTrigger id="location-agent" className="w-full">
                  <SelectValue>
                    {(v: string) => {
                      if (v === NONE) return 'Aucun pour l’instant'
                      const a = agents.data?.find((x) => x.id === v)
                      return a ? `${a.firstName} ${a.lastName}` : (location?.agentName ?? '…')
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Aucun pour l’instant</SelectItem>
                  {(agents.data ?? [])
                    .filter((a) => a.isActive)
                    .map((a) => {
                      const other = taken.find((t) => t.agentId === a.id && t.id !== location?.id)
                      return (
                        <SelectItem key={a.id} value={a.id} disabled={!!other}>
                          {a.firstName} {a.lastName}
                          {other && ` (déjà sur ${other.name})`}
                        </SelectItem>
                      )
                    })}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}
        {location && (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            En service (retiré : il n’apparaît plus, son historique est conservé)
          </label>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate(undefined)}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            {location ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
