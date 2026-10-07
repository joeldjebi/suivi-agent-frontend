import { Check, MapPinned } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Zone } from '@/lib/types'
import { cn } from '@/lib/utils'

export type Assignment = { kind: 'agent'; groupId: string | null } | { kind: 'group'; groupId: string } | { kind: 'open' }

/**
 * Zones proposées selon l'affectation : pour un groupe, ses zones et les zones libres ; pour un
 * agent, celles de son groupe et les zones libres (sans groupe : les zones libres) ; ouverte :
 * toutes celles du périmètre. Sans groupes dans la structure : toutes.
 */
export function eligibleZones(zones: Zone[], assignment: Assignment, useGroups: boolean): Zone[] {
  const active = zones.filter((z) => z.isActive)
  if (!useGroups || assignment.kind === 'open') return active
  const free = (z: Zone) => !z.groupIds?.length
  const groupId = assignment.groupId
  return active.filter((z) => free(z) || (!!groupId && z.groupIds?.includes(groupId)))
}

/** Choix des zones d'une mission (au moins une). */
export function ZonePicker({
  zones,
  value,
  onChange,
  groupName,
}: {
  zones: Zone[]
  value: string[]
  onChange: (ids: string[]) => void
  groupName?: (id: string) => string | undefined
}) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  const all = zones.length > 0 && zones.every((z) => value.includes(z.id))
  if (!zones.length)
    return (
      <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        <MapPinned className="size-4" aria-hidden /> Aucune zone disponible pour cette affectation.
      </p>
    )
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Zones de la mission">
        {zones.map((z) => {
          const on = value.includes(z.id)
          const owner = z.groupIds?.length ? groupName?.(z.groupIds[0]) : 'libre'
          return (
            <button
              key={z.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(z.id)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors hover:bg-muted/60',
                on && 'border-primary bg-primary/10 text-primary hover:bg-primary/15',
              )}
            >
              {on && <Check className="size-3.5" aria-hidden />}
              {z.name}
              {owner && <span className="text-xs text-muted-foreground">· {owner}</span>}
            </button>
          )
        })}
      </div>
      {zones.length > 1 && (
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => onChange(all ? [] : zones.map((z) => z.id))}>
          {all ? 'Tout désélectionner' : 'Toutes ces zones'}
        </Button>
      )}
    </div>
  )
}
