import { Role } from '@suivi/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  CircleSlash,
  Hourglass,
  MoreHorizontal,
  PenLine,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserMinus,
  UserX,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { IMPACT_LABELS, RemoveDialog } from '@/components/app/remove-dialog'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDate, formatPhone, formatRelative, fullName } from '@/lib/format'
import { roleLabel } from '@/lib/labels'
import { useApiMutation, useGroups } from '@/lib/queries'
import type { Page as PageOf, User, UserStats } from '@/lib/types'
import { cn } from '@/lib/utils'
import { UserFormDialog } from './UserFormDialog'
import { useOpenFromQuery } from '@/lib/use-open-from-query'

const ALL = 'all'
const NO_GROUP = 'none'

const STATUS: Record<string, string> = {
  [ALL]: 'Tous les statuts',
  active: 'Actifs',
  inactive: 'Désactivés',
  probation: 'En période d’essai',
}
const ACTIVITY: Record<string, string> = {
  [ALL]: 'Toute activité',
  working: 'En journée maintenant',
  never: 'N’a jamais travaillé',
  idle30: 'Inactif depuis 30 jours',
}
const SORT: Record<string, string> = { name: 'Nom', recent: 'Création récente', lastDay: 'Dernière journée' }

export function UsersPage() {
  const me = useMe()
  const isAdmin = me.user.role === Role.Admin
  const groups = useGroups()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [role, setRole] = useState<string>(ALL)
  const [groupId, setGroupId] = useState<string>(ALL)
  const [status, setStatus] = useState<string>(ALL)
  const [activity, setActivity] = useState<string>(ALL)
  const [sort, setSort] = useState<string>('name')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<User | undefined>()
  const [formOpen, setFormOpen] = useState(false)
  const [newRole, setNewRole] = useState<Role>(Role.Agent)
  // Lien « Ajouter un agent / un chef d'équipe » : formulaire ouvert sur ce rôle.
  useOpenFromQuery((role) => {
    setNewRole(role === Role.TeamLead ? Role.TeamLead : Role.Agent)
    setEditing(undefined)
    setFormOpen(true)
  })
  const [removing, setRemoving] = useState<User | null>(null)

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [search])

  const filtersActive = debounced !== '' || role !== ALL || groupId !== ALL || status !== ALL || activity !== ALL
  const resetFilters = () => {
    setSearch('')
    setDebounced('')
    setRole(ALL)
    setGroupId(ALL)
    setStatus(ALL)
    setActivity(ALL)
    setPage(1)
  }
  /** Un clic sur un chiffre applique le filtre correspondant. */
  const applyQuick = (next: { role?: string; status?: string; activity?: string; groupId?: string }) => {
    resetFilters()
    if (next.role) setRole(next.role)
    if (next.status) setStatus(next.status)
    if (next.activity) setActivity(next.activity)
    if (next.groupId) setGroupId(next.groupId)
  }

  const stats = useQuery({
    queryKey: ['users', 'stats'],
    queryFn: async () => (await api.get<UserStats>('/users/stats')).data,
  })
  const query = useQuery({
    queryKey: ['users', { search: debounced, role, groupId, status, activity, sort, page }],
    queryFn: async () =>
      (
        await api.get<PageOf<User>>('/users', {
          params: {
            search: debounced || undefined,
            role: role === ALL ? undefined : role,
            groupId: groupId === ALL || groupId === NO_GROUP ? undefined : groupId,
            withoutGroup: groupId === NO_GROUP || undefined,
            status: status === ALL ? undefined : status,
            activity: activity === ALL ? undefined : activity,
            sort: sort === 'name' ? undefined : sort,
            page,
            limit: 25,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
  })

  const reactivate = useApiMutation((id: string) => api.patch(`/users/${id}`, { isActive: true }), {
    success: 'Compte réactivé',
    invalidate: [['users']],
  })

  const groupName = (id: string | null) => groups.data?.find((g) => g.id === id)?.name ?? '—'
  const items = query.data?.items ?? []
  const pages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.limit)) : 1
  const s = stats.data
  const set = (setter: (v: string) => void) => (v: string | null) => {
    setter(v ?? ALL)
    setPage(1)
  }

  return (
    <Page>
      <PageHeader
        title="Utilisateurs"
        description={isAdmin ? 'Administrateurs, chefs d’équipe et agents de votre structure.' : 'Les agents de vos groupes.'}
        actions={
          isAdmin && (
            <Button
              onClick={() => {
                setEditing(undefined)
                setFormOpen(true)
              }}
            >
              <Plus aria-hidden /> Nouvel utilisateur
            </Button>
          )
        }
      />

      {s && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat
            icon={Users}
            label="Agents"
            value={s.agents}
            hint={
              s.quota
                ? `${s.quota.agents.used} / ${s.quota.agents.limit} actifs autorisés · ${s.quota.leads.used} / ${s.quota.leads.limit} chef${s.quota.leads.limit > 1 ? 's' : ''}`
                : isAdmin
                  ? `${s.teamLeads} chef${s.teamLeads > 1 ? 's' : ''} · ${s.admins} admin${s.admins > 1 ? 's' : ''}`
                  : undefined
            }
            onClick={() => applyQuick({ role: Role.Agent })}
          />
          <Stat
            icon={ShieldCheck}
            label="En journée maintenant"
            value={s.working}
            tone="text-status-active"
            hint={`${s.createdThisMonth} compte${s.createdThisMonth > 1 ? 's' : ''} créé${s.createdThisMonth > 1 ? 's' : ''} ce mois-ci`}
            onClick={() => applyQuick({ activity: 'working' })}
          />
          <Stat
            icon={UserMinus}
            label="Inactifs depuis 30 jours"
            value={s.idle30 + s.never}
            tone={s.idle30 + s.never ? 'text-status-paused' : undefined}
            hint={`dont ${s.never} n’ayant jamais travaillé`}
            onClick={() => applyQuick({ activity: s.never && !s.idle30 ? 'never' : 'idle30' })}
          />
          {me.settings.useGroups && (
            <Stat
              icon={UserCog}
              label="Agents sans groupe"
              value={s.withoutGroup}
              tone={s.withoutGroup ? 'text-status-alert' : undefined}
              hint="À rattacher à une équipe"
              onClick={() => applyQuick({ groupId: NO_GROUP })}
            />
          )}
          <Stat
            icon={CircleSlash}
            label="Comptes désactivés"
            value={s.inactive}
            hint={`${s.probation} en période d’essai`}
            onClick={() => applyQuick({ status: 'inactive' })}
          />
        </div>
      )}

      <div className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <div className="flex flex-col gap-1.5 xl:col-span-2">
          <Label htmlFor="user-search">Recherche</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="user-search"
              type="search"
              placeholder="Nom, email ou numéro"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        {isAdmin && <FilterSelect label="Rôle" value={role} onChange={set(setRole)} options={{ [ALL]: 'Tous les rôles', ...roleLabel }} />}
        {me.settings.useGroups && (
          <FilterSelect
            label="Groupe"
            value={groupId}
            onChange={set(setGroupId)}
            options={{
              [ALL]: 'Tous les groupes',
              [NO_GROUP]: 'Sans groupe',
              ...Object.fromEntries((groups.data ?? []).map((g) => [g.id, g.name])),
            }}
          />
        )}
        <FilterSelect label="Statut" value={status} onChange={set(setStatus)} options={STATUS} />
        <FilterSelect label="Activité" value={activity} onChange={set(setActivity)} options={ACTIVITY} />
        <FilterSelect label="Trier par" value={sort} onChange={(v) => setSort(v ?? 'name')} options={SORT} />
      </div>

      {filtersActive && query.data && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            {query.data.total} résultat{query.data.total > 1 ? 's' : ''}
          </span>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <X aria-hidden /> Effacer les filtres
          </Button>
        </div>
      )}

      <QueryState query={query}>
        {items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucun utilisateur"
            description={filtersActive ? 'Aucun résultat pour ces filtres.' : undefined}
            action={
              filtersActive ? (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Effacer les filtres
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className={cn('overflow-x-auto rounded-lg border bg-card', query.isPlaceholderData && 'opacity-60')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Rôle</TableHead>
                  {me.settings.useGroups && <TableHead>Groupe</TableHead>}
                  <TableHead>Activité</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead>Statut</TableHead>
                  {isAdmin && (
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((u) => (
                  <TableRow key={u.id} className={u.isActive ? undefined : 'text-muted-foreground'}>
                    <TableCell>
                      <div className="font-medium">{fullName(u)}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap">{formatPhone(u.phone)}</TableCell>
                    <TableCell>{roleLabel[u.role]}</TableCell>
                    {me.settings.useGroups && (
                      <TableCell>
                        {u.role === Role.Agent ? (
                          u.groupId ? (
                            groupName(u.groupId)
                          ) : (
                            <span className="text-status-alert">Sans groupe</span>
                          )
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    )}
                    <TableCell className="whitespace-nowrap">
                      {u.role !== Role.Agent ? (
                        <span className="text-muted-foreground">—</span>
                      ) : u.working ? (
                        <StatusPill tone="active" icon={ShieldCheck} label="En journée" />
                      ) : u.lastDay ? (
                        <>
                          <div>Dernière journée {formatDate(u.lastDay)}</div>
                          <div className="text-xs text-muted-foreground">
                            {u.days30 ?? 0} journée{(u.days30 ?? 0) > 1 ? 's' : ''} sur 30 jours
                          </div>
                        </>
                      ) : (
                        <span className="text-status-paused">Jamais travaillé</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                      {u.lastLoginAt ? formatRelative(u.lastLoginAt) : 'Jamais'}
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {!u.isActive && <StatusPill tone="ended" icon={CircleSlash} label="Désactivé" />}
                        {u.onProbation && <StatusPill tone="paused" icon={Hourglass} label="Période d’essai" />}
                        {u.isActive && !u.onProbation && <span className="text-sm text-muted-foreground">Actif</span>}
                      </span>
                      <div className="mt-0.5 text-xs text-muted-foreground">Créé le {formatDate(u.createdAt)}</div>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon-sm" aria-label={`Actions pour ${fullName(u)}`} />}
                          >
                            <MoreHorizontal aria-hidden />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(u)
                                setFormOpen(true)
                              }}
                            >
                              <PenLine aria-hidden /> Modifier
                            </DropdownMenuItem>
                            {!u.isActive && (
                              <DropdownMenuItem disabled={reactivate.isPending} onClick={() => reactivate.mutate(u.id)}>
                                <UserCheck aria-hidden /> Réactiver
                              </DropdownMenuItem>
                            )}
                            {u.id !== me.user.id && (
                              <DropdownMenuItem variant="destructive" onClick={() => setRemoving(u)}>
                                <UserX aria-hidden /> {u.isActive ? 'Désactiver ou supprimer…' : 'Supprimer définitivement…'}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Précédent
            </Button>
            <span className="tabular-nums text-muted-foreground">
              Page {page} / {pages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Suivant
            </Button>
          </div>
        )}
      </QueryState>

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} defaultRole={newRole} />
      <RemoveDialog
        target={removing && { name: fullName(removing), isActive: removing.isActive }}
        onOpenChange={(o) => !o && setRemoving(null)}
        config={
          removing && {
            noun: 'le compte de',
            url: `/users/${removing.id}`,
            deactivateLabel: 'Désactiver le compte',
            deactivateEffect: 'La personne est déconnectée immédiatement et ses places dans les zones sont libérées.',
            impactLabels: IMPACT_LABELS.user,
            invalidate: [['users'], ['groups'], ['live']],
          }
        }
      />
    </Page>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  icon: LucideIcon
  label: string
  value: number
  hint?: string
  tone?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {label}
      </span>
      <span className={cn('mt-1 block text-3xl font-semibold tabular-nums', tone)}>{value}</span>
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </button>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string | null) => void
  options: Record<string, string>
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue>{(v: string) => options[v]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([k, l]) => (
            <SelectItem key={k} value={k}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
