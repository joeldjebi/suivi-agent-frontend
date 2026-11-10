import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateTime, formatPhone } from '@/lib/format'
import { cn } from '@/lib/utils'
import { platformApi } from '../api'
import { to } from '../config'
import { ApproveRegistrationDialog, RegistrationStatusPill, RejectRegistrationDialog } from '../registrations'
import type { PlatformRegistration, PlatformSettings } from '../types'

/** Inscriptions des structures à valider par l'éditeur (le compte reste bloqué jusque-là). */
export function RegistrationsPage() {
  const [status, setStatus] = useState<'pending' | 'all'>('pending')
  const [deciding, setDeciding] = useState<{ registration: PlatformRegistration; decision: 'approve' | 'reject' } | null>(null)
  const query = useQuery({
    queryKey: ['platform', 'registrations', status],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await platformApi.get<{ items: PlatformRegistration[]; pending: number }>('/registrations', { params: { status } })).data,
  })
  const settings = useQuery({
    queryKey: ['platform', 'settings'],
    queryFn: async () => (await platformApi.get<PlatformSettings>('/settings')).data,
  })
  const packages = settings.data?.onboardingPackages ?? []
  return (
    <Page>
      <PageHeader
        title="Inscriptions"
        description="Structures qui se sont inscrites. Une structure reste bloquée tant qu'elle n'est pas validée ; à la validation, son essai démarre et la mise en place est ajoutée à sa première facture."
      />
      <Tabs value={status} onValueChange={(v) => setStatus(v as 'pending' | 'all')}>
        <TabsList>
          <TabsTrigger value="pending">
            À valider
            {query.data && <span className="ml-1 text-xs text-muted-foreground tabular-nums">{query.data.pending}</span>}
          </TabsTrigger>
          <TabsTrigger value="all">Toutes</TabsTrigger>
        </TabsList>
      </Tabs>
      <QueryState query={query} rows={5}>
        {query.data?.items.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title={status === 'pending' ? 'Aucune inscription à valider' : 'Aucune inscription'}
            description="Les nouvelles structures qui s'inscrivent apparaissent ici."
          />
        ) : (
          <div className={cn('overflow-x-auto rounded-lg border bg-card', query.isFetching && 'opacity-70')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reçue</TableHead>
                  <TableHead>Structure</TableHead>
                  <TableHead>Administrateur</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data?.items.map((r) => (
                  <TableRow key={r.tenantId}>
                    <TableCell className="text-sm whitespace-nowrap tabular-nums">{formatDateTime(r.createdAt)}</TableCell>
                    <TableCell>
                      <Link to={to(`/tenants/${r.tenantId}`)} className="font-medium hover:underline">
                        {r.tenantName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.adminName && <p className="font-medium">{r.adminName}</p>}
                      <p className="text-muted-foreground">
                        {[r.adminPhone && formatPhone(r.adminPhone), r.adminEmail].filter(Boolean).join(' · ')}
                      </p>
                    </TableCell>
                    <TableCell>
                      <RegistrationStatusPill status={r.approvalStatus} />
                      {r.rejectionReason && <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">{r.rejectionReason}</p>}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.approvalStatus === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" onClick={() => setDeciding({ registration: r, decision: 'approve' })}>
                            Valider
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDeciding({ registration: r, decision: 'reject' })}>
                            Refuser
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>
      {deciding?.decision === 'approve' && (
        <ApproveRegistrationDialog registration={deciding.registration} packages={packages} onClose={() => setDeciding(null)} />
      )}
      {deciding?.decision === 'reject' && (
        <RejectRegistrationDialog registration={deciding.registration} onClose={() => setDeciding(null)} />
      )}
    </Page>
  )
}
