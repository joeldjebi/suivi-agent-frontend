import type { PayGridComponents } from '@suivi/shared'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { fullName } from '@/lib/format'
import { useAgents, useAllUsers, useApiMutation, useGroups, useMissionTypes } from '@/lib/queries'
import type { PayGrid } from '@/lib/types'
import { MoneyField, Section } from './fields'
import { num, str, type Num } from './num'
import { Role } from '@suivi/shared'

export function GridDialog({ open, onOpenChange, grid }: { open: boolean; onOpenChange: (o: boolean) => void; grid?: PayGrid }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        {open && <GridForm grid={grid} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function GridForm({ grid, onDone }: { grid?: PayGrid; onDone: () => void }) {
  const { settings } = useMe()
  const groups = useGroups()
  const agents = useAgents()
  const leads = useAllUsers(Role.TeamLead)
  const types = useMissionTypes()
  const c = grid?.components ?? {}
  const t = grid?.targets ?? {}

  const [name, setName] = useState(grid?.name ?? '')
  const [active, setActive] = useState(grid?.isActive ?? true)
  const [roles, setRoles] = useState<Set<string>>(new Set(t.roles ?? (grid ? [] : ['agent'])))
  const [groupIds, setGroupIds] = useState<Set<string>>(new Set(t.groupIds ?? []))
  const [userIds, setUserIds] = useState<Set<string>>(new Set(t.userIds ?? []))
  const [fixed, setFixed] = useState(str(c.fixed))
  const [perDay, setPerDay] = useState(str(c.perDay?.amount))
  const [minHours, setMinHours] = useState(str(c.perDay?.minHours))
  const [inZone, setInZone] = useState(!!c.perDay?.requireInZone)
  const [perForm, setPerForm] = useState(str(c.perForm?.amount))
  const [byType, setByType] = useState<Record<string, Num>>(
    Object.fromEntries(Object.entries(c.perForm?.byType ?? {}).map(([k, v]) => [k, str(v)])),
  )
  const [commission, setCommission] = useState(str(c.commission?.percent))
  const [tiers, setTiers] = useState<{ threshold: Num; amount: Num }[]>(
    (c.objectiveBonus ?? []).map((b) => ({ threshold: str(b.thresholdPercent), amount: str(b.amount) })),
  )
  const [teamDay, setTeamDay] = useState(str(c.teamBonus?.perTeamDay))
  const [teamForm, setTeamForm] = useState(str(c.teamBonus?.perTeamForm))
  const [dedClosed, setDedClosed] = useState(str(c.deductions?.perAutoClosedDay))
  const [dedRejected, setDedRejected] = useState(str(c.deductions?.perRejectedForm))
  const [dedMocked, setDedMocked] = useState(str(c.deductions?.perMockedDay))
  const [cap, setCap] = useState(str(c.cap))

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string, on: boolean) => {
    const next = new Set(set)
    if (on) next.add(id)
    else next.delete(id)
    setter(next)
  }

  const components = (): PayGridComponents => {
    const types = Object.fromEntries(
      Object.entries(byType)
        .filter(([, v]) => num(v) !== null)
        .map(([k, v]) => [k, num(v)!]),
    )
    return {
      fixed: num(fixed),
      perDay: num(perDay) !== null ? { amount: num(perDay)!, minHours: num(minHours), requireInZone: inZone } : null,
      perForm: num(perForm) !== null || Object.keys(types).length ? { amount: num(perForm) ?? 0, byType: types } : null,
      commission: num(commission) !== null ? { percent: num(commission)! } : null,
      objectiveBonus: tiers
        .filter((x) => num(x.threshold) !== null && num(x.amount) !== null)
        .map((x) => ({ thresholdPercent: num(x.threshold)!, amount: num(x.amount)! })),
      teamBonus: num(teamDay) !== null || num(teamForm) !== null ? { perTeamDay: num(teamDay), perTeamForm: num(teamForm) } : null,
      deductions: { perAutoClosedDay: num(dedClosed), perRejectedForm: num(dedRejected), perMockedDay: num(dedMocked) },
      cap: num(cap),
    }
  }

  const save = useApiMutation(
    () => {
      const body = {
        name: name.trim(),
        isActive: active,
        components: components(),
        targets: { roles: [...roles], groupIds: [...groupIds], userIds: [...userIds] },
      }
      return grid ? api.put(`/pay/grids/${grid.id}`, body) : api.post('/pay/grids', body)
    },
    { success: grid ? 'Grille mise à jour' : 'Grille créée', invalidate: [['pay']], onSuccess: onDone },
  )
  const noTarget = !roles.size && !groupIds.size && !userIds.size

  return (
    <>
      <DialogHeader>
        <DialogTitle>{grid ? 'Modifier la grille' : 'Nouvelle grille de rémunération'}</DialogTitle>
        <DialogDescription>
          Les gains sont calculés automatiquement à partir de l’activité. Laissez un champ vide pour ne pas l’utiliser.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grid-name">Nom</Label>
            <Input id="grid-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Agents terrain" />
          </div>
          <label className="flex h-9 items-center gap-2 text-sm">
            <Switch checked={active} onCheckedChange={setActive} /> Active
          </label>
        </div>

        <Section
          title="S’applique à"
          hint="Une grille attribuée à un agent l’emporte sur celle de son groupe, qui l’emporte sur celle du rôle."
        >
          <div className="flex flex-wrap gap-4">
            {[
              ['agent', 'Tous les agents'],
              ['team_lead', 'Tous les chefs d’équipe'],
            ].map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <Checkbox checked={roles.has(k)} onCheckedChange={(v) => toggle(roles, setRoles, k, v)} /> {l}
              </label>
            ))}
          </div>
          {settings.useGroups && (groups.data?.length ?? 0) > 0 && (
            <CheckList
              title="Groupes"
              items={(groups.data ?? []).map((g) => ({ id: g.id, label: g.name }))}
              selected={groupIds}
              onToggle={(id, v) => toggle(groupIds, setGroupIds, id, v)}
            />
          )}
          <CheckList
            title="Personnes précises"
            items={[...(leads.data ?? []), ...(agents.data ?? [])].filter((u) => u.isActive).map((u) => ({ id: u.id, label: fullName(u) }))}
            selected={userIds}
            onToggle={(id, v) => toggle(userIds, setUserIds, id, v)}
          />
        </Section>

        <Section title="Fixe et journées">
          <div className="grid gap-3 sm:grid-cols-3">
            <MoneyField id="fixed" label="Fixe par période" value={fixed} onChange={setFixed} />
            <MoneyField id="per-day" label="Par journée validée" value={perDay} onChange={setPerDay} />
            <MoneyField id="min-hours" label="Heures minimum" suffix="h" value={minHours} onChange={setMinHours} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch size="sm" checked={inZone} onCheckedChange={setInZone} /> La journée ne compte que si l’agent est resté dans sa zone (80
            % des positions)
          </label>
          <p className="text-xs text-muted-foreground">Une journée avec une position simulée ne compte jamais.</p>
        </Section>

        <Section title="Formulaires et commission">
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyField id="per-form" label="Par formulaire accepté" value={perForm} onChange={setPerForm} />
            <MoneyField id="commission" label="Commission sur les montants saisis" suffix="%" value={commission} onChange={setCommission} />
          </div>
          {(types.data?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">Montant propre à un type de mission (sinon, le montant par formulaire) :</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {types.data?.map((ty) => (
                  <MoneyField
                    key={ty.id}
                    id={`type-${ty.id}`}
                    label={ty.name}
                    value={byType[ty.id] ?? ''}
                    onChange={(v) => setByType({ ...byType, [ty.id]: v })}
                  />
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section
          title="Primes d’objectif"
          hint="Pour chaque mission arrivée à échéance sur la période : le palier le plus haut atteint est versé."
        >
          {tiers.map((x, i) => (
            <div key={i} className="flex items-end gap-2">
              <MoneyField
                id={`tier-t-${i}`}
                label="Objectif atteint à"
                suffix="%"
                value={x.threshold}
                onChange={(v) => setTiers(tiers.map((y, j) => (j === i ? { ...y, threshold: v } : y)))}
              />
              <MoneyField
                id={`tier-a-${i}`}
                label="Prime"
                value={x.amount}
                onChange={(v) => setTiers(tiers.map((y, j) => (j === i ? { ...y, amount: v } : y)))}
              />
              <Button variant="ghost" size="icon" aria-label="Retirer ce palier" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}>
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-fit" onClick={() => setTiers([...tiers, { threshold: '100', amount: '' }])}>
            <Plus aria-hidden /> Ajouter un palier
          </Button>
        </Section>

        <Section title="Chef d’équipe" hint="Selon l’activité des agents de ses groupes.">
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyField id="team-day" label="Par journée de l’équipe" value={teamDay} onChange={setTeamDay} />
            <MoneyField id="team-form" label="Par formulaire de l’équipe" value={teamForm} onChange={setTeamForm} />
          </div>
        </Section>

        <Section title="Retenues et plafond">
          <div className="grid gap-3 sm:grid-cols-2">
            <MoneyField id="ded-closed" label="Par journée non clôturée" value={dedClosed} onChange={setDedClosed} />
            <MoneyField id="ded-rejected" label="Par formulaire rejeté" value={dedRejected} onChange={setDedRejected} />
            <MoneyField id="ded-mocked" label="Par journée avec position simulée" value={dedMocked} onChange={setDedMocked} />
            <MoneyField id="cap" label="Plafond par période" value={cap} onChange={setCap} />
          </div>
        </Section>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button disabled={!name.trim() || noTarget || save.isPending} onClick={() => save.mutate(undefined)}>
          {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Enregistrer
        </Button>
      </DialogFooter>
    </>
  )
}

function CheckList({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string
  items: { id: string; label: string }[]
  selected: Set<string>
  onToggle: (id: string, on: boolean) => void
}) {
  const [filter, setFilter] = useState('')
  const shown = items.filter((i) => i.label.toLowerCase().includes(filter.trim().toLowerCase()))
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">
          {title} {selected.size > 0 && <span className="text-muted-foreground">({selected.size})</span>}
        </p>
        {items.length > 6 && (
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrer"
            aria-label={`Filtrer ${title}`}
            className="h-7 w-40 text-xs"
          />
        )}
      </div>
      <div className="grid max-h-36 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
        {shown.map((i) => (
          <label key={i.id} className="flex items-center gap-2 text-sm">
            <Checkbox checked={selected.has(i.id)} onCheckedChange={(v) => onToggle(i.id, v)} /> {i.label}
          </label>
        ))}
        {shown.length === 0 && <p className="text-xs text-muted-foreground">Aucun résultat</p>}
      </div>
    </div>
  )
}
