import { DemoRequestStatus } from '@suivi/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Inbox, StickyNote } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime, formatPhone } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { platformApi } from '../api'
import type { Paged } from '../types'

interface Lead {
  id: string
  name: string
  organization: string
  email: string
  phone: string
  agents: number | null
  message: string | null
  status: DemoRequestStatus
  notes: string | null
  createdAt: string
}

const STATUS: Record<DemoRequestStatus, string> = {
  new: 'Nouvelle',
  contacted: 'Contactée',
  won: 'Devenue cliente',
  lost: 'Sans suite',
}
const ALL = 'all'
const PAGE_SIZE = 30

/** Demandes de démo reçues depuis le site vitrine. */
export function LeadsPage() {
  const [status, setStatus] = useState<string>(DemoRequestStatus.New)
  const [page, setPage] = useState(1)
  const [noting, setNoting] = useState<Lead | null>(null)
  const query = useQuery({
    queryKey: ['platform', 'leads', { status, page }],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await platformApi.get<Paged<Lead> & { counts: Record<DemoRequestStatus, number> }>('/demo-requests', {
          params: { status: status === ALL ? undefined : status, page, limit: PAGE_SIZE },
        })
      ).data,
  })
  const update = useApiMutation(
    (input: { id: string; status?: DemoRequestStatus; notes?: string }) =>
      platformApi.patch(`/demo-requests/${input.id}`, { status: input.status, notes: input.notes }),
    { success: 'Demande mise à jour', invalidate: [['platform', 'leads']], onSuccess: () => setNoting(null) },
  )
  const counts = query.data?.counts
  return (
    <Page>
      <PageHeader
        title="Demandes de démo"
        description="Envoyées depuis le site vitrine. Rappelez vite : une demande traitée dans l’heure se convertit bien mieux."
      />
      <Tabs
        value={status}
        onValueChange={(v) => {
          setStatus(v as string)
          setPage(1)
        }}
      >
        <TabsList>
          {(Object.keys(STATUS) as DemoRequestStatus[]).map((s) => (
            <TabsTrigger key={s} value={s}>
              {STATUS[s]}
              {counts && <span className="ml-1 text-xs text-muted-foreground tabular-nums">{counts[s]}</span>}
            </TabsTrigger>
          ))}
          <TabsTrigger value={ALL}>Toutes</TabsTrigger>
        </TabsList>
      </Tabs>
      <QueryState query={query} rows={6}>
        {query.data?.items.length === 0 ? (
          <EmptyState icon={Inbox} title="Aucune demande" description="Les demandes envoyées depuis le site apparaîtront ici." />
        ) : (
          <div className={cn('overflow-x-auto rounded-lg border bg-card', query.isFetching && 'opacity-70')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reçue</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Besoin</TableHead>
                  <TableHead>Suivi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data?.items.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm whitespace-nowrap tabular-nums">{formatDateTime(l.createdAt)}</TableCell>
                    <TableCell>
                      <p className="font-medium">{l.organization}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.name} ·{' '}
                        <a href={`tel:${l.phone}`} className="hover:underline">
                          {formatPhone(l.phone)}
                        </a>{' '}
                        ·{' '}
                        <a href={`mailto:${l.email}`} className="hover:underline">
                          {l.email}
                        </a>
                      </p>
                    </TableCell>
                    <TableCell className="max-w-sm text-sm">
                      {l.agents && <p className="font-medium">{l.agents} agents</p>}
                      <p className="text-muted-foreground">{l.message ?? '—'}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Select value={l.status} onValueChange={(v) => v && update.mutate({ id: l.id, status: v as DemoRequestStatus })}>
                          <SelectTrigger className="h-8 w-40" aria-label="Statut de la demande">
                            <SelectValue>{(v: DemoRequestStatus) => STATUS[v]}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(STATUS) as DemoRequestStatus[]).map((s) => (
                              <SelectItem key={s} value={s}>
                                {STATUS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Notes"
                          title={l.notes ?? 'Ajouter une note'}
                          onClick={() => setNoting(l)}
                        >
                          <StickyNote className={cn(l.notes && 'text-primary')} aria-hidden />
                        </Button>
                      </div>
                      {l.notes && <p className="mt-1 max-w-xs truncate text-xs text-muted-foreground">{l.notes}</p>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>
      {query.data && (
        <Pagination
          page={query.data.page}
          pages={Math.max(1, Math.ceil(query.data.total / PAGE_SIZE))}
          total={query.data.total}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      )}
      {noting && <NotesDialog lead={noting} onClose={() => setNoting(null)} onSave={(notes) => update.mutate({ id: noting.id, notes })} />}
    </Page>
  )
}

function NotesDialog({ lead, onClose, onSave }: { lead: Lead; onClose: () => void; onSave: (notes: string) => void }) {
  const [notes, setNotes] = useState(lead.notes ?? '')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Notes · {lead.organization}</DialogTitle>
          <DialogDescription>Appels, prochain rendez-vous, besoins particuliers.</DialogDescription>
        </DialogHeader>
        <Textarea rows={5} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => onSave(notes)}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
