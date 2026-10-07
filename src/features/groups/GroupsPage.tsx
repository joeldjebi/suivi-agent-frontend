import { Role } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import { ArchiveRestore, CircleSlash, Loader2, MapPinned, PenLine, Plus, Trash2, Users, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { IMPACT_LABELS, RemoveDialog } from '@/components/app/remove-dialog'
import { SearchInput } from '@/components/app/search-input'
import { StatusPill } from '@/components/app/status'
import { Switch } from '@/components/ui/switch'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatWorkday, fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAgents, useAllUsers, useApiMutation, useGroups, useZones } from '@/lib/queries'
import type { Group, GroupDetail } from '@/lib/types'
import { DurationSelect } from '@/components/app/duration-select'

const NONE = 'none'

export function GroupDialog({ open, onOpenChange, group }: { open: boolean; onOpenChange: (o: boolean) => void; group?: Group }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <GroupForm group={group} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function GroupForm({ group, onDone }: { group?: Group; onDone: () => void }) {
  const { settings } = useMe()
  const leaders = useAllUsers(Role.TeamLead)
  const [name, setName] = useState(group?.name ?? '')
  const [leaderId, setLeaderId] = useState<string>(group?.leaderId ?? NONE)
  const [workday, setWorkday] = useState<number | null>(group?.workdayMinutes ?? null)

  const save = useApiMutation(
    () => {
      const body = { name: name.trim(), leaderId: leaderId === NONE ? null : leaderId, workdayMinutes: workday }
      return group ? api.patch(`/groups/${group.id}`, body) : api.post('/groups', body)
    },
    { success: group ? 'Groupe mis à jour' : 'Groupe créé', invalidate: [['groups']], onSuccess: onDone },
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle>{group ? 'Modifier le groupe' : 'Nouveau groupe'}</DialogTitle>
        <DialogDescription>Le chef d'équipe suit les agents du groupe et approuve leurs choix de zone.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="group-name">Nom</FieldLabel>
          <Input id="group-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel>Chef d'équipe</FieldLabel>
          <Select value={leaderId} onValueChange={(v) => setLeaderId(v ?? NONE)}>
            <SelectTrigger className="w-full" aria-label="Chef d'équipe">
              <SelectValue>
                {(v: string) => (v === NONE ? 'Aucun (l’administrateur approuve)' : fullName(leaders.data?.find((l) => l.id === v)))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Aucun (l’administrateur approuve)</SelectItem>
              {leaders.data?.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {fullName(l)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {leaders.data?.length === 0 && (
            <p className="text-xs text-muted-foreground">Créez d'abord un utilisateur avec le rôle « Chef d'équipe ».</p>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="group-workday">Durée de travail par jour</FieldLabel>
          <DurationSelect
            id="group-workday"
            value={workday}
            onChange={setWorkday}
            inheritLabel={`Celle de la structure (${formatWorkday(settings.workdayMinutes)})`}
          />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate(undefined)}>
          {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Enregistrer
        </Button>
      </DialogFooter>
    </>
  )
}

/** Membres et zones d'un groupe. */
function GroupSheet({ groupId, onClose }: { groupId: string | null; onClose: () => void }) {
  const { user } = useMe()
  const detail = useQuery({
    queryKey: ['groups', groupId],
    enabled: !!groupId,
    queryFn: async () => (await api.get<GroupDetail>(`/groups/${groupId}`)).data,
  })
  return (
    <Sheet open={!!groupId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{detail.data?.name ?? 'Groupe'}</SheetTitle>
          <SheetDescription>
            {user.role === Role.Admin
              ? 'Un agent appartient à un seul groupe : l’ajouter ici le retire de son groupe actuel.'
              : 'Agents et zones de votre groupe.'}
          </SheetDescription>
        </SheetHeader>
        {detail.data ? (
          <GroupEditor key={detail.dataUpdatedAt} detail={detail.data} onDone={onClose} />
        ) : (
          <p className="px-4 text-sm text-muted-foreground">Chargement…</p>
        )}
      </SheetContent>
    </Sheet>
  )
}

function GroupEditor({ detail, onDone }: { detail: GroupDetail; onDone: () => void }) {
  const { user } = useMe()
  const isAdmin = user.role === Role.Admin
  const agents = useAgents()
  const zones = useZones()
  const groups = useGroups()
  const groupId = detail.id
  const [tab, setTab] = useState<'members' | 'zones'>('members')
  const [members, setMembers] = useState<Set<string>>(() => new Set(detail.members.map((m) => m.id)))
  const [zoneIds, setZoneIds] = useState<Set<string>>(() => new Set(detail.zones.map((z) => z.id)))
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<'all' | 'selected' | 'free' | 'other'>('all')
  const needle = search.trim().toLowerCase()

  const save = useApiMutation(
    async () => {
      await api.put(`/groups/${groupId}/members`, { ids: [...members] })
      await api.put(`/groups/${groupId}/zones`, { ids: [...zoneIds] })
    },
    { success: 'Groupe enregistré', invalidate: [['groups'], ['users']], onSuccess: onDone },
  )

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string, checked: boolean) => {
    const next = new Set(set)
    if (checked) next.add(id)
    else next.delete(id)
    setter(next)
  }
  const otherGroup = (agentGroupId: string | null) =>
    agentGroupId && agentGroupId !== groupId ? groups.data?.find((g) => g.id === agentGroupId)?.name : null
  // Filtres du panneau : texte, puis cochés / sans groupe / dans un autre groupe.
  const shownAgents = (isAdmin ? agents.data?.filter((a) => a.isActive) : detail.members)?.filter(
    (a) =>
      (!needle || fullName(a).toLowerCase().includes(needle)) &&
      (scope === 'all' ||
        (scope === 'selected' && members.has(a.id)) ||
        (scope === 'free' && !a.groupId && !members.has(a.id)) ||
        (scope === 'other' && !!otherGroup(a.groupId))),
  )
  const shownZones = (isAdmin ? zones.data : detail.zones)?.filter(
    (z) => (!needle || z.name.toLowerCase().includes(needle)) && (scope !== 'selected' || zoneIds.has(z.id)),
  )
  const scopes: Record<string, string> =
    tab === 'members'
      ? { all: 'Tous', selected: 'Dans ce groupe', free: 'Sans groupe', other: 'Autres groupes' }
      : { all: 'Toutes', selected: 'Cochées' }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as typeof tab)
            setScope('all')
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="members">Agents ({members.size})</TabsTrigger>
            <TabsTrigger value="zones">Zones ({zoneIds.size})</TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={tab === 'members' ? 'Rechercher un agent' : 'Rechercher une zone'}
          label={tab === 'members' ? 'Rechercher un agent' : 'Rechercher une zone'}
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer la liste">
          {Object.entries(scopes).map(([k, l]) => (
            <Button
              key={k}
              size="xs"
              variant={scope === k ? 'default' : 'outline'}
              aria-pressed={scope === k}
              onClick={() => setScope(k as typeof scope)}
            >
              {l}
            </Button>
          ))}
        </div>
        <ScrollArea className="min-h-0 flex-1 rounded-md border">
          {tab === 'members' ? (
            <ul className="divide-y">
              {shownAgents?.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Aucun agent</li>}
              {shownAgents?.map((agent) => (
                <li key={agent.id}>
                  <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted">
                    <Checkbox
                      disabled={!isAdmin}
                      checked={members.has(agent.id)}
                      onCheckedChange={(c) => toggle(members, setMembers, agent.id, c)}
                    />
                    <span className="flex-1 text-sm">{fullName(agent)}</span>
                    {otherGroup(agent.groupId) && <span className="text-xs text-muted-foreground">{otherGroup(agent.groupId)}</span>}
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="divide-y">
              {shownZones?.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Aucune zone</li>}
              {shownZones?.map((zone) => (
                <li key={zone.id}>
                  <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted">
                    <Checkbox
                      disabled={!isAdmin}
                      checked={zoneIds.has(zone.id)}
                      onCheckedChange={(c) => toggle(zoneIds, setZoneIds, zone.id, c)}
                    />
                    <span className="flex-1 text-sm">{zone.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {zone.capacity === null ? 'illimitée' : `${zone.capacity} places`}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>
      {isAdmin && (
        <SheetFooter>
          <Button disabled={save.isPending} onClick={() => save.mutate(undefined)}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Enregistrer
          </Button>
        </SheetFooter>
      )}
    </>
  )
}

export function GroupsPage() {
  const { user } = useMe()
  const isAdmin = user.role === Role.Admin
  const [showInactive, setShowInactive] = useState(false)
  const groups = useGroups(showInactive)
  const leaders = useAllUsers(Role.TeamLead)
  const [dialog, setDialog] = useState<{ open: boolean; group?: Group }>({ open: false })
  const [openId, setOpenId] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Group | null>(null)
  const [search, setSearch] = useState('')
  const [leaderFilter, setLeaderFilter] = useState<'all' | 'with' | 'without'>('all')
  const leaderName = (g: Group) => (g.leaderId === user.id ? fullName(user) : fullName(leaders.data?.find((l) => l.id === g.leaderId)))
  const needle = search.trim().toLowerCase()
  const shown = (groups.data ?? []).filter(
    (g) =>
      (!needle || `${g.name} ${g.leaderId ? leaderName(g) : ''}`.toLowerCase().includes(needle)) &&
      (leaderFilter === 'all' || (leaderFilter === 'with') === !!g.leaderId),
  )
  const reactivate = useApiMutation((id: string) => api.patch(`/groups/${id}`, { isActive: true }), {
    success: 'Groupe réactivé',
    invalidate: [['groups'], ['zones']],
  })

  return (
    <Page>
      <PageHeader
        title="Groupes"
        description="Chaque groupe a ses agents, ses zones et éventuellement un chef d'équipe."
        actions={
          isAdmin && (
            <Button onClick={() => setDialog({ open: true })}>
              <Plus aria-hidden /> Nouveau groupe
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Nom du groupe ou du chef"
          label="Rechercher un groupe"
          className="w-full sm:w-72"
        />
        <Select value={leaderFilter} onValueChange={(v) => setLeaderFilter((v as typeof leaderFilter) ?? 'all')}>
          <SelectTrigger className="w-48" aria-label="Chef d’équipe">
            <SelectValue>{(v: string) => ({ all: 'Avec ou sans chef', with: 'Avec un chef', without: 'Sans chef' })[v]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Avec ou sans chef</SelectItem>
            <SelectItem value="with">Avec un chef</SelectItem>
            <SelectItem value="without">Sans chef</SelectItem>
          </SelectContent>
        </Select>
        {isAdmin && (
          <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground">
            <Switch size="sm" checked={showInactive} onCheckedChange={setShowInactive} />
            Afficher les groupes désactivés
          </label>
        )}
        {groups.data && (needle || leaderFilter !== 'all') && (
          <span className="text-sm text-muted-foreground">
            {shown.length} groupe{shown.length > 1 ? 's' : ''} sur {groups.data.length}
          </span>
        )}
      </div>
      <QueryState query={groups}>
        {!shown.length ? (
          <EmptyState
            icon={UsersRound}
            title="Aucun groupe"
            description={
              groups.data?.length
                ? 'Aucun groupe ne correspond à cette recherche.'
                : isAdmin
                  ? 'Créez un groupe pour organiser vos agents par équipe.'
                  : undefined
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((g) => (
              <article
                key={g.id}
                className={cn('flex flex-col gap-3 rounded-lg border bg-card p-4', !g.isActive && 'border-dashed bg-muted/40')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 truncate font-semibold">
                      {g.name}
                      {!g.isActive && <StatusPill tone="ended" icon={CircleSlash} label="Désactivé" />}
                    </h2>
                    <p className="text-sm text-muted-foreground">{g.leaderId ? `Chef : ${leaderName(g)}` : 'Sans chef d’équipe'}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Modifier ${g.name}`}
                        onClick={() => setDialog({ open: true, group: g })}
                      >
                        <PenLine aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Désactiver ou supprimer ${g.name}`}
                        onClick={() => setRemoving(g)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="flex items-center gap-1.5 text-sm">
                  <Users className="size-4 text-muted-foreground" aria-hidden />
                  {g.agentCount ?? 0} agent(s)
                </p>
                {g.isActive ? (
                  <Button variant="outline" size="sm" onClick={() => setOpenId(g.id)}>
                    <MapPinned aria-hidden /> {isAdmin ? 'Gérer les agents et les zones' : 'Voir les agents et les zones'}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled={reactivate.isPending} onClick={() => reactivate.mutate(g.id)}>
                    <ArchiveRestore aria-hidden /> Réactiver le groupe
                  </Button>
                )}
              </article>
            ))}
          </div>
        )}
      </QueryState>
      <GroupDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} group={dialog.group} />
      <GroupSheet groupId={openId} onClose={() => setOpenId(null)} />
      <RemoveDialog
        target={removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        config={
          removing && {
            noun: 'le groupe',
            url: `/groups/${removing.id}`,
            deactivateEffect: 'Ses agents ne voient plus ses zones et son chef perd ses droits sur le groupe.',
            impactLabels: IMPACT_LABELS.group,
            invalidate: [['groups'], ['users'], ['missions'], ['zones']],
          }
        }
      />
    </Page>
  )
}
