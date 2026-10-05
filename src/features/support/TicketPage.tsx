import { SupportStatus, type SupportTicketInfo } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Loader2, Send } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Page, PageHeader, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { fullName } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { supportCategoryLabel } from '@/lib/support'
import { SupportStatusPill } from './SupportPage'
import { TicketThread } from './TicketThread'

/** Fil d'une demande d'aide : réponses du support, relance, fermeture. */
export function TicketPage() {
  const { id } = useParams<{ id: string }>()
  const [body, setBody] = useState('')
  const query = useQuery({
    queryKey: ['support', id],
    queryFn: async () => (await api.get<SupportTicketInfo>(`/support/tickets/${id}`)).data,
    refetchInterval: 30_000,
  })
  const reply = useApiMutation(() => api.post(`/support/tickets/${id}/messages`, { body: body.trim() }), {
    success: 'Message envoyé',
    invalidate: [['support']],
    onSuccess: () => setBody(''),
  })
  const close = useApiMutation(() => api.post(`/support/tickets/${id}/close`), {
    success: 'Demande fermée',
    invalidate: [['support']],
  })
  const t = query.data

  return (
    <Page>
      <Link to="/support" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Support
      </Link>
      <QueryState query={query}>
        {t && (
          <>
            <PageHeader
              title={`#${t.number} · ${t.subject}`}
              description={`${supportCategoryLabel[t.category]} · ouverte par ${fullName(t.createdBy)}`}
              actions={
                <div className="flex items-center gap-2">
                  <SupportStatusPill status={t.status} />
                  {t.status !== SupportStatus.Closed && (
                    <Button variant="outline" disabled={close.isPending} onClick={() => close.mutate(undefined)}>
                      <CheckCircle2 aria-hidden /> Fermer la demande
                    </Button>
                  )}
                </div>
              }
            />
            <section className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4">
              <TicketThread messages={t.messages ?? []} mine="tenant" />
            </section>
            {t.status === SupportStatus.Closed ? (
              <p className="text-sm text-muted-foreground">
                Demande fermée. Pour une nouvelle question,{' '}
                <Link to="/support?new=1" className="text-primary underline underline-offset-2">
                  ouvrez une nouvelle demande
                </Link>
                .
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <Textarea
                  aria-label="Votre message"
                  rows={4}
                  maxLength={5000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Précisez ou répondez au support…"
                />
                <Button className="self-end" disabled={!body.trim() || reply.isPending} onClick={() => reply.mutate(undefined)}>
                  {reply.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
                  Envoyer
                </Button>
              </div>
            )}
          </>
        )}
      </QueryState>
    </Page>
  )
}
