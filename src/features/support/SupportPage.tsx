import { SupportCategory, SupportStatus, type SupportTicketInfo } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock, LifeBuoy, Loader2, MessageCircleReply, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { formatRelative, fullName } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { supportCategoryLabel, supportStatusLabel } from '@/lib/support'
import { cn } from '@/lib/utils'

export function SupportStatusPill({ status }: { status: SupportStatus }) {
  const [tone, icon] = (
    {
      [SupportStatus.Open]: ['paused', Clock],
      [SupportStatus.Answered]: ['info', MessageCircleReply],
      [SupportStatus.Closed]: ['ended', CheckCircle2],
    } as const
  )[status]
  return <StatusPill tone={tone} icon={icon} label={supportStatusLabel[status]} />
}

/** Demandes d'aide de la structure au support de Suivi Agent. */
export function SupportPage() {
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(params.get('new') === '1')
  const query = useQuery({
    queryKey: ['support'],
    queryFn: async () => (await api.get<SupportTicketInfo[]>('/support/tickets')).data,
  })
  const items = query.data ?? []

  return (
    <Page>
      <PageHeader
        title="Support"
        description="Une question, un problème ? Écrivez à l’équipe Suivi Agent : la réponse arrive ici et dans vos notifications."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden /> Nouvelle demande
          </Button>
        }
      />
      <QueryState query={query}>
        {items.length === 0 ? (
          <EmptyState
            icon={LifeBuoy}
            title="Aucune demande"
            description="Consultez la documentation, ou écrivez-nous si elle ne répond pas à votre question."
            action={
              <Button variant="outline" nativeButton={false} render={<Link to="/help" />}>
                Ouvrir la documentation
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border bg-card">
            {items.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/support/${t.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                >
                  <span className="w-14 text-sm text-muted-foreground tabular-nums">#{t.number}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn('truncate text-sm', t.status === SupportStatus.Answered ? 'font-semibold' : 'font-medium')}>
                      {t.subject}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {supportCategoryLabel[t.category]} · {fullName(t.createdBy)} · {formatRelative(t.lastMessageAt)}
                    </span>
                  </span>
                  <SupportStatusPill status={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      <NewTicketDialog
        open={creating}
        onOpenChange={(o) => {
          setCreating(o)
          if (!o && params.has('new')) setParams({}, { replace: true })
        }}
      />
    </Page>
  )
}

function NewTicketDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate()
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<SupportCategory>(SupportCategory.Question)
  const [message, setMessage] = useState('')
  const valid = subject.trim().length >= 4 && message.trim().length >= 10

  const create = useApiMutation(
    () =>
      api.post<SupportTicketInfo>('/support/tickets', {
        subject: subject.trim(),
        category,
        message: message.trim(),
        // Aide le support à comprendre : page d'origine et navigateur.
        context: {
          page: document.referrer ? new URL(document.referrer).pathname : window.location.pathname,
          userAgent: navigator.userAgent,
        },
      }),
    {
      success: 'Demande envoyée : le support vous répond ici',
      invalidate: [['support']],
      onSuccess: (res) => {
        onOpenChange(false)
        setSubject('')
        setMessage('')
        navigate(`/support/${res.data.id}`)
      },
    },
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle demande</DialogTitle>
          <DialogDescription>
            Décrivez la situation : l’écran concerné, le nom de l’agent ou de la mission, ce que vous attendiez.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="ticket-subject">Sujet</FieldLabel>
            <Input
              id="ticket-subject"
              value={subject}
              maxLength={140}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex. Export de la paie"
            />
          </Field>
          <Field>
            <FieldLabel>Catégorie</FieldLabel>
            <Select value={category} onValueChange={(v) => setCategory((v ?? SupportCategory.Question) as SupportCategory)}>
              <SelectTrigger className="w-full" aria-label="Catégorie">
                <SelectValue>{(v: SupportCategory) => supportCategoryLabel[v]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.values(SupportCategory).map((c) => (
                  <SelectItem key={c} value={c}>
                    {supportCategoryLabel[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="ticket-message">Message</FieldLabel>
            <Textarea id="ticket-message" rows={6} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)} />
            <FieldDescription>10 caractères au moins.</FieldDescription>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={!valid || create.isPending} onClick={() => create.mutate(undefined)}>
            {create.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
