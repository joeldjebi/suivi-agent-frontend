import { OutletStatus } from '@suivi/shared'
import { useQueries } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SearchInput } from '@/components/app/search-input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { categoryIcon } from './outlet-icons'
import { OUTLET_STATUS, STATUSES, type Outlet, type OutletPage } from './outlets'

/**
 * Choix des points de vente d'une mission de visites : ceux des zones de la mission, avec
 * recherche, filtre par statut et sélection de tout ce qui est affiché.
 */
export function OutletPicker({ zoneIds, value, onChange }: { zoneIds: string[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<OutletStatus | null>(null)
  const queries = useQueries({
    queries: zoneIds.map((zoneId) => ({
      queryKey: ['outlets', 'list', { zoneId }, 'picker'],
      queryFn: async () => (await api.get<OutletPage>('/outlets', { params: { zoneId, limit: 200 } })).data,
    })),
  })
  const loading = queries.some((r) => r.isLoading)
  const all = useMemo(() => {
    const byId = new Map<string, Outlet>()
    for (const r of queries) for (const o of r.data?.items ?? []) byId.set(o.id, o)
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [queries])
  const truncated = queries.some((r) => (r.data?.total ?? 0) > (r.data?.items.length ?? 0))
  const needle = q.trim().toLowerCase()
  const shown = all.filter(
    (o) =>
      (!status || o.status === status) && (!needle || [o.name, o.managerName, o.landmark].some((t) => t?.toLowerCase().includes(needle))),
  )
  const selected = new Set(value)
  const allShownSelected = shown.length > 0 && shown.every((o) => selected.has(o.id))
  const outsideZones = value.filter((id) => !all.some((o) => o.id === id)).length

  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((v) => v !== id))
  const toggleShown = () =>
    onChange(allShownSelected ? value.filter((id) => !shown.some((o) => o.id === id)) : [...new Set([...value, ...shown.map((o) => o.id)])])

  if (!zoneIds.length) {
    return <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Choisissez d’abord les zones.</p>
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <SearchInput value={q} onChange={setQ} placeholder="Nom, gérant, repère" label="Rechercher un point de vente" />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par statut">
        <Chip active={status === null} onClick={() => setStatus(null)}>
          Tous
        </Chip>
        {STATUSES.map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(status === s ? null : s)} color={OUTLET_STATUS[s].color}>
            {OUTLET_STATUS[s].label}
          </Chip>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium tabular-nums">
          {value.length} sélectionné{value.length > 1 ? 's' : ''}
        </span>
        <Button size="sm" variant="ghost" disabled={!shown.length} onClick={toggleShown}>
          {allShownSelected ? 'Désélectionner l’affichage' : `Tout sélectionner (${shown.length})`}
        </Button>
      </div>
      <ul className="flex max-h-64 flex-col divide-y overflow-y-auto rounded-md border">
        {loading ? (
          <li className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement…
          </li>
        ) : shown.length === 0 ? (
          <li className="p-4 text-center text-sm text-muted-foreground">
            {all.length ? 'Aucun point de vente ne correspond.' : 'Aucun point de vente dans ces zones.'}
          </li>
        ) : (
          shown.map((o) => {
            const Icon = categoryIcon(o.category)
            return (
              <li key={o.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted">
                  <Checkbox checked={selected.has(o.id)} onCheckedChange={(c) => toggle(o.id, c)} />
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: OUTLET_STATUS[o.status].color }}
                    aria-hidden
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{o.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[o.category, o.zone?.name, OUTLET_STATUS[o.status].label].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </label>
              </li>
            )
          })
        )}
      </ul>
      {truncated && (
        <p className="text-xs text-muted-foreground">
          Seuls les 200 premiers points de vente de chaque zone sont proposés : utilisez la recherche.
        </p>
      )}
      {outsideZones > 0 && (
        <p className="text-xs text-status-paused">
          {outsideZones} point{outsideZones > 1 ? 's' : ''} de vente choisi{outsideZones > 1 ? 's' : ''} hors des zones affichées.
        </p>
      )}
    </div>
  )
}

function Chip({ active, onClick, color, children }: { active: boolean; onClick: () => void; color?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium hover:bg-muted',
        active && 'border-primary bg-primary/10 text-primary',
      )}
    >
      {color && <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />}
      {children}
    </button>
  )
}
