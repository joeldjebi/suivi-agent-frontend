import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Bug, CheckCircle2, ExternalLink, Globe, RotateCcw, Server, Smartphone, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateTime, formatRelative } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { platformApi } from '../api'

type Source = 'api' | 'web' | 'mobile'

interface ErrorItem {
  id: string
  source: Source
  message: string
  route: string | null
  stack: string | null
  appVersion: string | null
  count: number
  tenantCount: number
  lastTenantName: string | null
  firstSeenAt: string
  lastSeenAt: string
  resolvedAt: string | null
}

interface ErrorLog {
  items: ErrorItem[]
  summary: { open: number; lastDay: number }
  sentryUrl: string | null
}

const SOURCES: Record<Source, { label: string; icon: LucideIcon }> = {
  api: { label: 'Serveur (API)', icon: Server },
  web: { label: 'Site web', icon: Globe },
  mobile: { label: 'App mobile', icon: Smartphone },
}

const ALL = 'all'

/**
 * Journal des erreurs de la plateforme : pannes du serveur, du site et de l'app, regroupées
 * par erreur identique. « Corrigée » la retire de la liste ; elle revient si elle se reproduit.
 */
export function ErrorsPage() {
  const [status, setStatus] = useState<'open' | 'resolved'>('open')
  const [source, setSource] = useState<Source | typeof ALL>(ALL)
  const [opened, setOpened] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ['platform', 'errors', status, source],
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    queryFn: async () =>
      (await platformApi.get<ErrorLog>('/errors', { params: { status, source: source === ALL ? undefined : source } })).data,
  })
  const resolve = useApiMutation(
    ({ id, resolved }: { id: string; resolved: boolean }) => platformApi.post(`/errors/${id}/resolve`, { resolved }),
    { invalidate: [['platform', 'errors']] },
  )
  const data = query.data
  const summary = data?.summary

  return (
    <Page>
      <PageHeader
        title="Erreurs"
        description="Pannes et bugs du serveur, du site et de l’app mobile, regroupés par erreur identique."
        actions={
          data?.sentryUrl && (
            <Button variant="outline" nativeButton={false} render={<a href={data.sentryUrl} target="_blank" rel="noreferrer" />}>
              <ExternalLink aria-hidden /> Ouvrir Sentry
            </Button>
          )
        }
      />

      {summary && (
        <div
          role="status"
          className={cn(
            'flex items-center gap-3 rounded-lg border p-4',
            summary.open === 0 ? 'border-status-active/30 bg-status-active/5' : 'border-status-alert/30 bg-status-alert/5',
          )}
        >
          {summary.open === 0 ? (
            <CheckCircle2 className="size-5 shrink-0 text-status-active" aria-hidden />
          ) : (
            <Bug className="size-5 shrink-0 text-status-alert" aria-hidden />
          )}
          <p className="text-sm">
            {summary.open === 0 ? (
              <span className="font-medium">Tout va bien : aucune erreur en cours.</span>
            ) : (
              <>
                <span className="font-medium">
                  {summary.open} erreur{summary.open > 1 ? 's' : ''} à traiter
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  · {summary.lastDay} survenue{summary.lastDay > 1 ? 's' : ''} ces dernières 24 h
                </span>
              </>
            )}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={status} onValueChange={(v) => setStatus(v as 'open' | 'resolved')}>
          <TabsList>
            <TabsTrigger value="open">À traiter</TabsTrigger>
            <TabsTrigger value="resolved">Corrigées</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Origine">
          {([ALL, 'api', 'web', 'mobile'] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={source === s ? 'secondary' : 'ghost'}
              aria-pressed={source === s}
              onClick={() => setSource(s)}
            >
              {s === ALL ? 'Toutes' : SOURCES[s].label}
            </Button>
          ))}
        </div>
      </div>

      <QueryState query={query}>
        {data && data.items.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={status === 'open' ? 'Aucune erreur à traiter' : 'Aucune erreur corrigée'}
            description={status === 'open' ? 'La plateforme fonctionne normalement.' : 'Les erreurs marquées corrigées apparaîtront ici.'}
          />
        ) : (
          <ul className={cn('flex flex-col gap-2', query.isPlaceholderData && 'opacity-60')}>
            {data?.items.map((e) => {
              const meta = SOURCES[e.source]
              const open = opened === e.id
              return (
                <li key={e.id} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <meta.icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium break-words">{e.message}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {meta.label}
                        {e.route && ` · ${e.route}`}
                        {e.appVersion && ` · version ${e.appVersion}`}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground tabular-nums">{e.count}</span> fois · dernière{' '}
                        {formatRelative(e.lastSeenAt)} · première le {formatDateTime(e.firstSeenAt)}
                        {e.tenantCount > 0 &&
                          ` · ${e.tenantCount} structure${e.tenantCount > 1 ? 's' : ''}${e.lastTenantName ? ` (dernière : ${e.lastTenantName})` : ''}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {e.stack && (
                        <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpened(open ? null : e.id)}>
                          {open ? 'Masquer le détail' : 'Détail'}
                        </Button>
                      )}
                      {e.resolvedAt ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resolve.isPending}
                          onClick={() => resolve.mutate({ id: e.id, resolved: false })}
                        >
                          <RotateCcw aria-hidden /> Rouvrir
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resolve.isPending}
                          onClick={() => resolve.mutate({ id: e.id, resolved: true })}
                        >
                          <CheckCircle2 aria-hidden /> Corrigée
                        </Button>
                      )}
                    </div>
                  </div>
                  {open && e.stack && (
                    <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed whitespace-pre-wrap">
                      {e.stack}
                    </pre>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </QueryState>
    </Page>
  )
}
