import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { FileClock } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { platformApi } from '../api'
import { to } from '../config'
import { auditActionLabel, auditSummary } from '../labels'
import type { AuditEntry, Paged } from '../types'

const PAGE_SIZE = 50

export function AuditPage() {
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['platform', 'audit', page],
    placeholderData: keepPreviousData,
    queryFn: async () => (await platformApi.get<Paged<AuditEntry>>('/audit', { params: { page, limit: PAGE_SIZE } })).data,
  })
  const data = query.data
  return (
    <Page>
      <PageHeader title="Journal" description="Toutes les actions faites depuis la console, y compris les connexions refusées." />
      <QueryState query={query} rows={10}>
        {data && data.items.length === 0 ? (
          <EmptyState icon={FileClock} title="Journal vide" />
        ) : (
          data && (
            <div className={cn('overflow-x-auto rounded-lg border bg-card', query.isFetching && 'opacity-70')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Par</TableHead>
                    <TableHead>Structure</TableHead>
                    <TableHead>Détail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm whitespace-nowrap tabular-nums">{formatDateTime(a.createdAt)}</TableCell>
                      <TableCell className={cn('font-medium', a.action.endsWith('_failed') && 'text-status-alert')}>
                        {auditActionLabel[a.action] ?? a.action}
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.adminName ?? '—'}
                        {a.ip && <p className="text-xs text-muted-foreground">{a.ip}</p>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.tenantId ? (
                          <Link to={to(`/tenants/${a.tenantId}`)} className="hover:underline">
                            {a.tenantName ?? 'Structure supprimée'}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="max-w-md text-xs break-words text-muted-foreground">{auditSummary(a.details)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        )}
      </QueryState>
      {data && (
        <Pagination
          page={data.page}
          pages={Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
          total={data.total}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      )}
    </Page>
  )
}
