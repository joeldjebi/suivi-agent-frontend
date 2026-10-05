import type { DocArticle, DocArticleSummary } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import { Role } from '@suivi/shared'
import { BookOpen, LifeBuoy, Rocket } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { SearchInput } from '@/components/app/search-input'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { Markdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'

/**
 * Manuel d'utilisation : sommaire par section, recherche, article. Réservé aux comptes
 * connectés ; le contenu est rédigé par l'éditeur.
 */
export function HelpPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useMe()
  const [search, setSearch] = useState('')
  const list = useQuery({
    queryKey: ['docs'],
    queryFn: async () => (await api.get<DocArticleSummary[]>('/documentation')).data,
    staleTime: 5 * 60_000,
  })
  const current = slug ?? list.data?.[0]?.slug
  const article = useQuery({
    queryKey: ['docs', current],
    enabled: !!current,
    queryFn: async () => (await api.get<DocArticle>(`/documentation/${current}`)).data,
  })

  const term = search.trim().toLowerCase()
  const sections = useMemo(() => {
    const groups = new Map<string, DocArticleSummary[]>()
    for (const a of list.data ?? []) {
      if (term && !`${a.title} ${a.summary} ${a.section}`.toLowerCase().includes(term)) continue
      groups.set(a.section, [...(groups.get(a.section) ?? []), a])
    }
    return [...groups.entries()]
  }, [list.data, term])

  return (
    <Page>
      <PageHeader
        title="Documentation"
        description="Le manuel d’utilisation de Suivi Agent : prise en main, terrain, organisation, application mobile."
        actions={
          user.role === Role.Admin && (
            <Button variant="outline" nativeButton={false} render={<Link to="/start" />}>
              <Rocket aria-hidden /> Guide « Bien démarrer »
            </Button>
          )
        }
      />
      <QueryState query={list}>
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <aside className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start" aria-label="Sommaire">
            <SearchInput value={search} onChange={setSearch} placeholder="Rechercher" label="Rechercher dans la documentation" />
            {sections.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">Aucun article ne correspond.</p>
            ) : (
              <nav className="flex flex-col gap-4 rounded-lg border bg-card p-3">
                {sections.map(([section, items]) => (
                  <div key={section} className="flex flex-col gap-0.5">
                    <p className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{section}</p>
                    {items.map((a) => (
                      <Link
                        key={a.slug}
                        to={`/help/${a.slug}`}
                        aria-current={a.slug === current ? 'page' : undefined}
                        className={cn(
                          'rounded-md px-2 py-1.5 text-sm hover:bg-muted',
                          a.slug === current && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent',
                        )}
                      >
                        {a.title}
                      </Link>
                    ))}
                  </div>
                ))}
              </nav>
            )}
          </aside>

          <article className="flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-5 sm:p-8">
            {!current ? (
              <EmptyState icon={BookOpen} title="Aucun article" description="La documentation n’est pas encore disponible." />
            ) : (
              <QueryState query={article}>
                {article.data && (
                  <>
                    <header className="flex flex-col gap-1 border-b pb-4">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{article.data.section}</p>
                      <h2 className="text-2xl font-semibold text-balance">{article.data.title}</h2>
                      {article.data.summary && <p className="text-muted-foreground">{article.data.summary}</p>}
                    </header>
                    <Markdown source={article.data.body} className="max-w-[68ch]" />
                    <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                      <p className="text-xs text-muted-foreground">
                        Mis à jour le {formatDate(article.data.updatedAt)} · © Suivi Agent, documentation réservée aux clients. Reproduction
                        interdite.
                      </p>
                      <Button size="sm" variant="outline" nativeButton={false} render={<Link to="/support?new=1" />}>
                        <LifeBuoy aria-hidden /> Contacter le support
                      </Button>
                    </footer>
                  </>
                )}
              </QueryState>
            )}
          </article>
        </div>
      </QueryState>
    </Page>
  )
}
