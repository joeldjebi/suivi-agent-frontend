import { Role } from '@suivi/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CircleDot, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EmptyState, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { SearchInput } from '@/components/app/search-input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card } from '@/features/stats/components'
import { formatDate, formatPhone, formatRelative, fullName } from '@/lib/format'
import { roleLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { platformApi } from '../api'
import type { TenantGroup, TenantUsers } from '../types'

const ALL = 'all'
const PAGE_SIZE = 25

/** Comptes et groupes de la structure, avec leur activité des 30 derniers jours. */
export function TeamsTab({ tenantId }: { tenantId: string }) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<string>(ALL)
  const [status, setStatus] = useState<string>(ALL)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const users = useQuery({
    queryKey: ['platform', 'tenant', tenantId, 'users', { search, role, status, page }],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await platformApi.get<TenantUsers>(`/tenants/${tenantId}/users`, {
          params: {
            search: search || undefined,
            role: role === ALL ? undefined : role,
            status: status === ALL ? undefined : status,
            page,
            limit: PAGE_SIZE,
          },
        })
      ).data,
  })
  const groups = useQuery({
    queryKey: ['platform', 'tenant', tenantId, 'groups'],
    queryFn: async () => (await platformApi.get<TenantGroup[]>(`/tenants/${tenantId}/groups`)).data,
  })
  const s = users.data?.summary

  return (
    <div className="flex flex-col gap-4">
      {s && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {(
            [
              ['Administrateurs', s.admins],
              ['Chefs d’équipe', s.leads],
              ['Agents', s.agents],
              ['Comptes actifs', s.active],
              ['Désactivés', s.inactive],
              ['En journée', s.working],
              ['Agents sans journée (30 j)', s.idle30],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-lg border bg-card px-3 py-2.5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}

      <Card title="Comptes" flush>
        <div className="grid gap-2 border-b p-3 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <SearchInput value={searchInput} onChange={setSearchInput} label="Rechercher un compte" placeholder="Nom, email ou numéro" />
          <Select
            value={role}
            onValueChange={(v) => {
              setRole(v ?? ALL)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full" aria-label="Rôle">
              <SelectValue>{(v: string) => (v === ALL ? 'Tous les rôles' : roleLabel[v as Role])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les rôles</SelectItem>
              {[Role.Admin, Role.TeamLead, Role.Agent].map((r) => (
                <SelectItem key={r} value={r}>
                  {roleLabel[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v ?? ALL)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full" aria-label="Statut du compte">
              <SelectValue>{(v: string) => ({ [ALL]: 'Tous les comptes', active: 'Actifs', inactive: 'Désactivés' })[v]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les comptes</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="inactive">Désactivés</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <QueryState query={users} rows={6}>
          {users.data && users.data.items.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={Users} title="Aucun compte" description="Aucun compte ne correspond à ces critères." />
            </div>
          ) : (
            <div className={cn('overflow-x-auto', users.isFetching && 'opacity-70')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Personne</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Dernière connexion</TableHead>
                    <TableHead>Dernière journée</TableHead>
                    <TableHead className="text-right">Journées (30 j)</TableHead>
                    <TableHead className="text-right">Formulaires (30 j)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.data?.items.map((u) => (
                    <TableRow key={u.id} className={cn(!u.isActive && 'text-muted-foreground')}>
                      <TableCell>
                        <p className="flex items-center gap-1.5 font-medium">
                          {fullName(u)}
                          {u.working && <CircleDot className="size-3.5 text-status-active" aria-label="En journée" />}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {u.email}
                          {u.phone && ` · ${formatPhone(u.phone)}`}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-sm">{roleLabel[u.role as Role]}</span>
                          {u.groupName && <Badge variant="outline">{u.groupName}</Badge>}
                          {!u.isActive && <Badge variant="secondary">Désactivé</Badge>}
                          {u.onProbation && u.isActive && <Badge variant="outline">Période d’essai</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{u.lastLoginAt ? formatRelative(u.lastLoginAt) : 'Jamais'}</TableCell>
                      <TableCell className="text-sm">
                        {u.role === Role.Agent ? (u.lastDay ? formatDate(u.lastDay) : 'Jamais') : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{u.role === Role.Agent ? u.days30 : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{u.role === Role.Agent ? u.forms30 : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </QueryState>
        {users.data && (
          <div className="border-t p-3">
            <Pagination
              page={users.data.page}
              pages={Math.max(1, Math.ceil(users.data.total / PAGE_SIZE))}
              total={users.data.total}
              pageSize={PAGE_SIZE}
              onPage={setPage}
            />
          </div>
        )}
      </Card>

      <Card title="Groupes" flush>
        <QueryState query={groups} rows={3}>
          {groups.data?.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucun groupe : la structure fonctionne sans groupes.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Groupe</TableHead>
                    <TableHead>Chef d’équipe</TableHead>
                    <TableHead className="text-right">Agents actifs</TableHead>
                    <TableHead>Zones</TableHead>
                    <TableHead className="text-right">Journées (30 j)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.data?.map((g) => (
                    <TableRow key={g.id} className={cn(!g.isActive && 'text-muted-foreground')}>
                      <TableCell className="font-medium">
                        {g.name}
                        {!g.isActive && (
                          <Badge variant="secondary" className="ml-2">
                            Désactivé
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{g.leaderName ?? <span className="text-muted-foreground">Sans chef</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">{g.agents}</TableCell>
                      <TableCell className="max-w-xs text-sm">{g.zones.length ? g.zones.join(', ') : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{g.days30}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </QueryState>
      </Card>
    </div>
  )
}
