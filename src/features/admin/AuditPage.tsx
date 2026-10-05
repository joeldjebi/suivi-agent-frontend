import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { FileClock } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDateTime, fullName } from '@/lib/format'
import { useAllUsers } from '@/lib/queries'
import type { AuditLog, Page as PageOf } from '@/lib/types'

const ACTIONS: Record<string, string> = {
  'auth.register': 'Création de l’espace',
  'auth.login': 'Connexion',
  'auth.login_failed': 'Échec de connexion',
}

/** « ZonesController.create » → « Zones · create » */
function describe(action: string) {
  return ACTIONS[action] ?? action.replace('Controller.', ' · ').replace(/([a-z])([A-Z])/g, '$1 $2')
}

export function AuditPage() {
  const { settings } = useMe()
  const users = useAllUsers()
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['audit', page],
    queryFn: async () => (await api.get<PageOf<AuditLog>>('/audit-logs', { params: { page, limit: 50 } })).data,
    placeholderData: keepPreviousData,
  })
  const items = query.data?.items ?? []
  const pages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.limit)) : 1

  return (
    <Page>
      <PageHeader title="Journal d'accès" description="Connexions et modifications effectuées dans votre espace." />
      <QueryState query={query}>
        {items.length === 0 ? (
          <EmptyState icon={FileClock} title="Journal vide" />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Requête</TableHead>
                  <TableHead>Résultat</TableHead>
                  <TableHead>Adresse IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="tabular-nums">{formatDateTime(log.createdAt, settings.timezone)}</TableCell>
                    <TableCell>{log.userId ? fullName(users.data?.find((u) => u.id === log.userId)) : '—'}</TableCell>
                    <TableCell>{describe(log.action)}</TableCell>
                    <TableCell className="max-w-64 truncate font-mono text-xs text-muted-foreground">
                      {log.method ? `${log.method} ${log.path}` : '—'}
                    </TableCell>
                    <TableCell className={log.statusCode && log.statusCode >= 400 ? 'text-destructive' : undefined}>
                      {log.statusCode ?? (log.action === 'auth.login_failed' ? 'refusé' : 'ok')}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.ip ?? '—'}</TableCell>
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
    </Page>
  )
}
