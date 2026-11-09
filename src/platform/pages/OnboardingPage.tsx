import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { GraduationCap } from 'lucide-react'
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
import { formatMoney } from '../labels'
import { DecideOnboardingDialog, OnboardingStatusPill } from '../onboarding'
import type { PlatformOnboardingRequest } from '../types'

/** Demandes de mise en place envoyées par les structures depuis leur page Abonnement. */
export function OnboardingPage() {
  const [status, setStatus] = useState<'pending' | 'all'>('pending')
  const [deciding, setDeciding] = useState<{ request: PlatformOnboardingRequest; decision: 'accept' | 'reject' } | null>(null)
  const query = useQuery({
    queryKey: ['platform', 'onboarding-requests', status],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await platformApi.get<{ items: PlatformOnboardingRequest[]; pending: number }>('/onboarding-requests', {
          params: { status },
        })
      ).data,
  })
  return (
    <Page>
      <PageHeader
        title="Mise en place"
        description="Forfaits demandés par les structures. Acceptée, une demande ajoute les frais à leur prochaine facture ; refusée, le motif leur est envoyé."
      />
      <Tabs value={status} onValueChange={(v) => setStatus(v as 'pending' | 'all')}>
        <TabsList>
          <TabsTrigger value="pending">
            À traiter
            {query.data && <span className="ml-1 text-xs text-muted-foreground tabular-nums">{query.data.pending}</span>}
          </TabsTrigger>
          <TabsTrigger value="all">Toutes</TabsTrigger>
        </TabsList>
      </Tabs>
      <QueryState query={query} rows={5}>
        {query.data?.items.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={status === 'pending' ? 'Aucune demande à traiter' : 'Aucune demande'}
            description="Les structures demandent un forfait depuis leur page Abonnement."
          />
        ) : (
          <div className={cn('overflow-x-auto rounded-lg border bg-card', query.isFetching && 'opacity-70')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reçue</TableHead>
                  <TableHead>Structure</TableHead>
                  <TableHead>Forfait</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data?.items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm whitespace-nowrap tabular-nums">{formatDateTime(r.createdAt)}</TableCell>
                    <TableCell>
                      <Link to={to(`/tenants/${r.tenantId}?tab=billing`)} className="font-medium hover:underline">
                        {r.tenantName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {[r.requestedByName, r.requestedByPhone && formatPhone(r.requestedByPhone), r.requestedByEmail]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-sm text-sm">
                      <p className="font-medium">
                        {r.packageName} · {formatMoney(r.packagePrice)}
                      </p>
                      {r.message && <p className="text-muted-foreground">{r.message}</p>}
                    </TableCell>
                    <TableCell>
                      <OnboardingStatusPill status={r.status} />
                      {r.status === 'accepted' && r.amount !== null && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{formatMoney(r.amount)} facturés</p>
                      )}
                      {r.decisionNote && <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">{r.decisionNote}</p>}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" onClick={() => setDeciding({ request: r, decision: 'accept' })}>
                            Accepter
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDeciding({ request: r, decision: 'reject' })}>
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
      {deciding && <DecideOnboardingDialog {...deciding} onClose={() => setDeciding(null)} />}
    </Page>
  )
}
