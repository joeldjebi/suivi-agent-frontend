import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/features/stats/components'
import { formatDateTime } from '@/lib/format'
import { roleLabel } from '@/lib/labels'
import type { Role } from '@suivi/shared'
import { cn } from '@/lib/utils'
import { platformApi } from '../api'
import { auditActionLabel, auditSummary } from '../labels'
import type { AuditEntry, Paged, TenantLog } from '../types'

const PAGE_SIZE = 30
type Kind = 'all' | 'logins' | 'changes' | 'failed'

/** Libellé d'une entrée du journal de la structure. */
function describe(l: TenantLog): string {
  if (l.action === 'auth.login') return 'Connexion'
  if (l.action === 'auth.login_failed') return 'Connexion refusée'
  if (l.action === 'auth.register') return 'Inscription de la structure'
  return l.method && l.path ? `${l.method} ${l.path.replace(/^\/api/, '')}` : l.action
}

/** Journal de la structure (connexions, modifications) et actions de l'éditeur sur elle. */
export function JournalTab({ tenantId, history }: { tenantId: string; history: AuditEntry[] }) {
  const [kind, setKind] = useState<Kind>('all')
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['platform', 'tenant', tenantId, 'activity', { kind, page }],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await platformApi.get<Paged<TenantLog>>(`/tenants/${tenantId}/activity`, {
          params: { kind: kind === 'all' ? undefined : kind, page, limit: PAGE_SIZE },
        })
      ).data,
  })
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <Card
        title="Journal de la structure"
        actions={
          <Tabs
            value={kind}
            onValueChange={(v) => {
              setKind(v as Kind)
              setPage(1)
            }}
          >
            <TabsList>
              <TabsTrigger value="all">Tout</TabsTrigger>
              <TabsTrigger value="logins">Connexions</TabsTrigger>
              <TabsTrigger value="changes">Modifications</TabsTrigger>
              <TabsTrigger value="failed">Échecs</TabsTrigger>
            </TabsList>
          </Tabs>
        }
        flush
      >
        <QueryState query={query} rows={8}>
          {query.data?.items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Rien à afficher.</p>
          ) : (
            <div className={cn('overflow-x-auto', query.isFetching && 'opacity-70')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Qui</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="text-right">Résultat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data?.items.map((l) => {
                    const failed = l.action === 'auth.login_failed' || (l.statusCode ?? 0) >= 400
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-sm whitespace-nowrap tabular-nums">{formatDateTime(l.createdAt)}</TableCell>
                        <TableCell className="text-sm">
                          {l.userName ?? '—'}
                          {l.userRole && <p className="text-xs text-muted-foreground">{roleLabel[l.userRole as Role]}</p>}
                        </TableCell>
                        <TableCell className={cn('max-w-sm text-sm break-all', l.method && 'font-mono text-xs')}>{describe(l)}</TableCell>
                        <TableCell className={cn('text-right text-sm tabular-nums', failed && 'font-medium text-status-alert')}>
                          {l.statusCode ?? (failed ? 'refusée' : 'ok')}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </QueryState>
        {query.data && (
          <div className="border-t p-3">
            <Pagination
              page={query.data.page}
              pages={Math.max(1, Math.ceil(query.data.total / PAGE_SIZE))}
              total={query.data.total}
              pageSize={PAGE_SIZE}
              onPage={setPage}
            />
          </div>
        )}
      </Card>

      <Card title="Actions de l’éditeur" flush>
        {history.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aucune action de l’éditeur sur cette structure.</p>
        ) : (
          <ol className="divide-y">
            {history.map((h) => (
              <li key={h.id} className="flex gap-3 px-4 py-2.5 text-sm">
                <span className="w-28 shrink-0 text-xs text-muted-foreground tabular-nums">{formatDateTime(h.createdAt)}</span>
                <div className="min-w-0">
                  <p className="font-medium">{auditActionLabel[h.action] ?? h.action}</p>
                  <p className="text-xs break-words text-muted-foreground">
                    {[h.adminName, auditSummary(h.details)].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}
