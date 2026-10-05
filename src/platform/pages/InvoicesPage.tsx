import { InvoiceStatus } from '@suivi/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Receipt, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { SearchInput } from '@/components/app/search-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { platformApi } from '../api'
import { InvoiceStatusPill } from '../components'
import { to } from '../config'
import { PaymentDialog, VoidDialog } from '../invoice-dialogs'
import { formatMoney, monthLabel, paymentMethodLabel } from '../labels'
import { usePlanName } from '../plans'
import type { Invoice, Paged } from '../types'

const ALL = 'all'
const PAGE_SIZE = 30
const STATUS_LABEL: Record<string, string> = {
  [ALL]: 'Toutes les factures',
  [InvoiceStatus.Pending]: 'À payer',
  [InvoiceStatus.Paid]: 'Payées',
  [InvoiceStatus.Void]: 'Annulées',
}

export function InvoicesPage() {
  const planName = usePlanName()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>(InvoiceStatus.Pending)
  const [month, setMonth] = useState('')
  const [overdue, setOverdue] = useState(false)
  const [page, setPage] = useState(1)
  const [paying, setPaying] = useState<Invoice | null>(null)
  const [voiding, setVoiding] = useState<Invoice | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const filtered = search !== '' || status !== InvoiceStatus.Pending || month !== '' || overdue
  const reset = () => {
    setSearchInput('')
    setSearch('')
    setStatus(InvoiceStatus.Pending)
    setMonth('')
    setOverdue(false)
    setPage(1)
  }

  const query = useQuery({
    queryKey: ['platform', 'invoices', { search, status, month, overdue, page }],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await platformApi.get<Paged<Invoice> & { totalAmount: number }>('/invoices', {
          params: {
            search: search || undefined,
            status: status === ALL ? undefined : status,
            month: month || undefined,
            overdue: overdue || undefined,
            page,
            limit: PAGE_SIZE,
          },
        })
      ).data,
  })
  const data = query.data

  return (
    <Page>
      <PageHeader
        title="Factures"
        description="Factures de toutes les structures. Les paiements se font hors plateforme (Mobile Money, virement, espèces) : enregistrez-les ici dès réception."
      />
      <div className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,1fr))_auto]">
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          label="Rechercher une facture"
          placeholder="Numéro ou structure"
          className="sm:col-span-2 lg:col-span-1"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v ?? ALL)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full" aria-label="Statut">
            <SelectValue>{(v: string) => STATUS_LABEL[v]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABEL).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="month"
          aria-label="Mois facturé"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value)
            setPage(1)
          }}
        />
        <label className="flex h-9 items-center gap-2 text-sm whitespace-nowrap">
          <Switch
            checked={overdue}
            onCheckedChange={(v) => {
              setOverdue(v)
              setPage(1)
            }}
          />
          Échues seulement
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {data && (
            <>
              {data.total} facture{data.total > 1 ? 's' : ''} ·{' '}
              <span className="font-medium text-foreground tabular-nums">{formatMoney(data.totalAmount)}</span>
            </>
          )}
        </span>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <X aria-hidden /> Réinitialiser les filtres
          </Button>
        )}
      </div>

      <QueryState query={query} rows={8}>
        {data && data.items.length === 0 ? (
          <EmptyState icon={Receipt} title="Aucune facture" description="Aucune facture ne correspond à ces critères." />
        ) : (
          data && (
            <div className={cn('overflow-x-auto rounded-lg border bg-card', query.isFetching && 'opacity-70')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Structure</TableHead>
                    <TableHead>Mois</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <Link to={to(`/tenants/${i.tenantId}`)} className="font-medium hover:underline">
                          {i.tenantName}
                        </Link>
                        <p className="text-xs text-muted-foreground">{i.number}</p>
                      </TableCell>
                      <TableCell>
                        <p className="capitalize">{monthLabel(i.month)}</p>
                        <p className="text-xs text-muted-foreground">
                          {planName(i.planCode)}
                          {i.extraAgents > 0 && ` · +${i.extraAgents} agents`}
                          {i.discountPercent > 0 && ` · remise ${i.discountPercent} %`}
                          {i.prorataPercent < 100 && ` · prorata ${i.prorataPercent} %`}
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatMoney(i.amount, i.currency)}</TableCell>
                      <TableCell>
                        <InvoiceStatusPill invoice={i} />
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {i.status === 'paid'
                            ? `${formatDate(i.paidAt)} · ${paymentMethodLabel[i.paymentMethod ?? ''] ?? '—'}${i.paymentReference ? ` · ${i.paymentReference}` : ''}`
                            : i.status === 'void'
                              ? i.voidReason
                              : `Échéance ${formatDate(i.dueAt)}`}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        {i.status === 'pending' && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" onClick={() => setPaying(i)}>
                              Paiement reçu
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Annuler la facture ${i.number}`}
                              title="Annuler la facture"
                              onClick={() => setVoiding(i)}
                            >
                              <X aria-hidden />
                            </Button>
                          </div>
                        )}
                      </TableCell>
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
      <PaymentDialog invoice={paying} onClose={() => setPaying(null)} />
      <VoidDialog invoice={voiding} onClose={() => setVoiding(null)} />
    </Page>
  )
}
