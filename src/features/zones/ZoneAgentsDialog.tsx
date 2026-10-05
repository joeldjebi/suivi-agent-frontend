import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { api } from '@/lib/api'
import { fullName } from '@/lib/format'
import { useAgents, useApiMutation } from '@/lib/queries'
import type { User, Zone } from '@/lib/types'

/** Agents autorisés sur une zone réservée (RG-15). */
export function ZoneAgentsDialog({ zone, onOpenChange }: { zone: Zone | null; onOpenChange: (open: boolean) => void }) {
  const current = useQuery({
    queryKey: ['zones', zone?.id, 'agents'],
    enabled: !!zone,
    queryFn: async () => (await api.get<User[]>(`/zones/${zone!.id}/agents`)).data,
  })
  return (
    <Dialog open={!!zone} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agents autorisés — {zone?.name}</DialogTitle>
          <DialogDescription>Seuls ces agents pourront choisir cette zone réservée.</DialogDescription>
        </DialogHeader>
        {zone && current.data ? (
          <AgentsForm zone={zone} initial={current.data} onDone={() => onOpenChange(false)} />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">Chargement…</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AgentsForm({ zone, initial, onDone }: { zone: Zone; initial: User[]; onDone: () => void }) {
  const agents = useAgents()
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial.map((u) => u.id)))

  const save = useApiMutation(() => api.put(`/zones/${zone.id}/agents`, { ids: [...selected] }), {
    success: 'Accès mis à jour',
    invalidate: [['zones']],
    onSuccess: onDone,
  })

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })

  return (
    <>
      <ScrollArea className="max-h-80 rounded-md border">
        {agents.isPending ? (
          <p className="p-4 text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <ul className="divide-y">
            {agents.data
              ?.filter((a) => a.isActive)
              .map((agent) => (
                <li key={agent.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted">
                    <Checkbox checked={selected.has(agent.id)} onCheckedChange={(c) => toggle(agent.id, c)} />
                    <span className="text-sm">{fullName(agent)}</span>
                  </label>
                </li>
              ))}
          </ul>
        )}
      </ScrollArea>
      <DialogFooter>
        <span className="mr-auto text-sm text-muted-foreground">{selected.size} sélectionné(s)</span>
        <Button variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button onClick={() => save.mutate(undefined)} disabled={save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Enregistrer
        </Button>
      </DialogFooter>
    </>
  )
}
