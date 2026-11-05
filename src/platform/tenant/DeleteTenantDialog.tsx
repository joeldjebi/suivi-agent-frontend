import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useApiMutation } from '@/lib/queries'
import { platformApi } from '../api'
import { to } from '../config'
import type { TenantDetail } from '../types'

interface Deleted {
  name: string
  users: number
  outlets: number
  orders: number
  submissions: number
  photos: number
  invoices: number
}

/**
 * Suppression définitive d'une structure (compte propriétaire seulement) : son nom tapé en
 * entier et le mot de passe du propriétaire. Toutes ses données partent, sans retour possible.
 */
export function DeleteTenantDialog({ open, d, onClose }: { open: boolean; d: TenantDetail; onClose: () => void }) {
  const id = useId()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmName, setConfirmName] = useState('')
  const [password, setPassword] = useState('')
  const name = d.tenant.name
  const nameOk = confirmName.trim() === name.trim()
  const close = () => {
    setConfirmName('')
    setPassword('')
    onClose()
  }
  const remove = useApiMutation(
    async () => (await platformApi.post<Deleted>(`/tenants/${d.tenant.id}/delete`, { confirmName, password })).data,
    {
      onSuccess: (r) => {
        toast.success(
          `« ${r.name} » supprimée : ${r.users} compte${r.users > 1 ? 's' : ''}, ${r.outlets} point${r.outlets > 1 ? 's' : ''} de vente, ${r.orders} commande${r.orders > 1 ? 's' : ''}, ${r.photos} photo${r.photos > 1 ? 's' : ''}`,
        )
        close()
        // La fiche n'existe plus : retour à la liste, sans relire la structure supprimée.
        queryClient.removeQueries({ queryKey: ['platform', 'tenant', d.tenant.id] })
        void navigate(to('/tenants'), { replace: true })
        void queryClient.invalidateQueries({ queryKey: ['platform'] })
      },
    },
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Supprimer définitivement {name} ?</DialogTitle>
          <DialogDescription>
            Tout ce qui appartient à cette structure est effacé, sans retour possible : ses comptes ({d.counts.agents} agent
            {d.counts.agents > 1 ? 's' : ''}, {d.counts.leads} chef{d.counts.leads > 1 ? 's' : ''} d’équipe et ses administrateurs), ses
            zones, journées et positions, ses missions et formulaires, ses points de vente, produits, commandes et ventes, son stock et sa
            caisse, sa paie, son abonnement et ses factures, ses photos. Les personnes connectées sont déconnectées.
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Seule la sauvegarde de la nuit permettrait de la retrouver. Pour simplement couper l’accès, préférez « Suspendre ».
        </p>
        <FieldGroup>
          <Field data-invalid={confirmName !== '' && !nameOk}>
            <FieldLabel htmlFor={`${id}-name`}>
              Tapez le nom de la structure : <span className="font-semibold">{name}</span>
            </FieldLabel>
            <Input id={`${id}-name`} value={confirmName} autoComplete="off" onChange={(e) => setConfirmName(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-password`}>Votre mot de passe</FieldLabel>
            <Input
              id={`${id}-password`}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FieldDescription>Celui de votre compte propriétaire, pour confirmer que c’est bien vous.</FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Annuler
          </Button>
          <Button variant="destructive" disabled={!nameOk || !password || remove.isPending} onClick={() => remove.mutate(undefined)}>
            {remove.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
            Supprimer définitivement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
