import { Role } from '@suivi/shared'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, errorCode } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { fullName } from '@/lib/format'
import { useAgents, useApiMutation, useZones } from '@/lib/queries'

/** Affecte directement un agent à une zone, y compris en cours de journée (RG-31, RG-32). */
export function ReassignDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Monté à chaque ouverture : le formulaire repart de zéro. */}
        <ReassignForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ReassignForm({ onDone }: { onDone: () => void }) {
  const { user } = useMe()
  const agents = useAgents()
  const zones = useZones()
  const [agentId, setAgentId] = useState<string | null>(null)
  const [zoneId, setZoneId] = useState<string | null>(null)
  const [force, setForce] = useState(false)

  const reassign = useApiMutation(() => api.post('/zone-requests/reassign', { agentId, zoneId, force: force || undefined }), {
    success: 'Agent réaffecté, il a été notifié',
    invalidate: [['zone-requests'], ['zones'], ['live']],
    onSuccess: onDone,
  })
  const zone = zones.data?.find((z) => z.id === zoneId)
  // La zone a pu se remplir entre l'affichage et l'envoi.
  const full = zone?.isFull || errorCode(reassign.error) === 'ZONE_FULL'

  return (
    <>
      <DialogHeader>
        <DialogTitle>Réaffecter un agent</DialogTitle>
        <DialogDescription>
          L'agent est placé immédiatement dans la zone, même en cours de journée. Sa place actuelle est libérée.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel>Agent</FieldLabel>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="w-full" aria-label="Agent">
              <SelectValue placeholder="Choisir un agent">
                {(v: string | null) => fullName(agents.data?.find((a) => a.id === v))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {agents.data
                ?.filter((a) => a.isActive)
                .map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {fullName(a)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Zone</FieldLabel>
          <Select
            value={zoneId}
            onValueChange={(v) => {
              setZoneId(v)
              reassign.reset()
            }}
          >
            <SelectTrigger className="w-full" aria-label="Zone">
              <SelectValue placeholder="Choisir une zone">{(v: string | null) => zones.data?.find((z) => z.id === v)?.name}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {zones.data?.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.name}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {z.capacity === null ? 'illimitée' : z.isFull ? 'pleine' : `${z.placesLeft} place(s)`}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {zone?.isFull && <FieldDescription className="text-status-alert">Cette zone est pleine.</FieldDescription>}
        </Field>
        {user.role === Role.Admin && full && (
          <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
            <Checkbox checked={force} onCheckedChange={setForce} className="mt-0.5" />
            <span>
              Dépasser la capacité de la zone
              <span className="block text-xs text-muted-foreground">
                Réservé aux administrateurs ; l'opération est tracée dans le journal.
              </span>
            </span>
          </label>
        )}
      </FieldGroup>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button disabled={!agentId || !zoneId || reassign.isPending} onClick={() => reassign.mutate(undefined)}>
          {reassign.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Réaffecter
        </Button>
      </DialogFooter>
    </>
  )
}
