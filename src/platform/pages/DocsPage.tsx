import { useQuery } from '@tanstack/react-query'
import { BookOpen, Eye, EyeOff, Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime } from '@/lib/format'
import { Markdown } from '@/lib/markdown'
import { useApiMutation } from '@/lib/queries'
import { platformApi } from '../api'

type Audience = 'admin' | 'team_lead' | 'agent'
interface Article {
  id: string
  slug: string
  section: string
  title: string
  summary: string
  body: string
  audience: Audience[]
  position: number
  published: boolean
  updatedAt: string
  updatedBy: string | null
}

const AUDIENCE: Record<Audience, string> = { admin: 'Administrateurs', team_lead: 'Chefs d’équipe', agent: 'Agents' }

/** Manuel d'utilisation : articles lus par les structures selon leur rôle. */
export function DocsPage() {
  const [editing, setEditing] = useState<Article | 'new' | null>(null)
  const query = useQuery({
    queryKey: ['platform', 'docs'],
    queryFn: async () => (await platformApi.get<Article[]>('/documentation')).data,
  })
  const restore = useApiMutation(() => platformApi.post('/documentation/restore-defaults'), {
    success: 'Articles par défaut manquants réinstallés',
    invalidate: [['platform', 'docs']],
  })
  const sections = useMemo(() => {
    const groups = new Map<string, Article[]>()
    for (const a of query.data ?? []) groups.set(a.section, [...(groups.get(a.section) ?? []), a])
    return [...groups.entries()]
  }, [query.data])

  return (
    <Page>
      <PageHeader
        title="Documentation"
        description="Manuel d’utilisation des structures, lu uniquement par les comptes connectés. Décrivez les écrans et les gestes, pas le fonctionnement interne."
        actions={
          <>
            <Button variant="outline" disabled={restore.isPending} onClick={() => restore.mutate(undefined)}>
              <RotateCcw aria-hidden /> Articles par défaut
            </Button>
            <Button onClick={() => setEditing('new')}>
              <Plus aria-hidden /> Nouvel article
            </Button>
          </>
        }
      />
      <QueryState query={query}>
        {sections.length === 0 ? (
          <EmptyState icon={BookOpen} title="Aucun article" description="Créez un article ou réinstallez le manuel par défaut." />
        ) : (
          <div className="flex flex-col gap-4">
            {sections.map(([section, items]) => (
              <section key={section} className="flex flex-col gap-2">
                <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{section}</h2>
                <ul className="flex flex-col divide-y rounded-lg border bg-card">
                  {items.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setEditing(a)}
                        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                      >
                        {a.published ? (
                          <Eye className="size-4 text-status-active" aria-label="Publié" />
                        ) : (
                          <EyeOff className="size-4 text-muted-foreground" aria-label="Non publié" />
                        )}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">{a.title}</span>
                          <span className="truncate text-xs text-muted-foreground">{a.summary || a.slug}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">{a.audience.map((x) => AUDIENCE[x]).join(', ')}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(a.updatedAt)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </QueryState>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-5xl">
          {editing && <ArticleForm article={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </Page>
  )
}

function ArticleForm({ article, onDone }: { article: Article | null; onDone: () => void }) {
  const [slug, setSlug] = useState(article?.slug ?? '')
  const [section, setSection] = useState(article?.section ?? '')
  const [title, setTitle] = useState(article?.title ?? '')
  const [summary, setSummary] = useState(article?.summary ?? '')
  const [body, setBody] = useState(article?.body ?? '')
  const [audience, setAudience] = useState<Set<Audience>>(new Set(article?.audience ?? ['admin', 'team_lead']))
  const [published, setPublished] = useState(article?.published ?? true)
  const valid =
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && section.trim().length >= 2 && title.trim().length >= 3 && body.trim() && audience.size > 0

  const save = useApiMutation(
    () => {
      const dto = { slug, section: section.trim(), title: title.trim(), summary: summary.trim(), body, audience: [...audience], published }
      return article ? platformApi.patch(`/documentation/${article.id}`, dto) : platformApi.post('/documentation', dto)
    },
    { success: article ? 'Article enregistré' : 'Article créé', invalidate: [['platform', 'docs']], onSuccess: onDone },
  )
  const remove = useApiMutation(() => platformApi.delete(`/documentation/${article!.id}`), {
    success: 'Article supprimé',
    invalidate: [['platform', 'docs']],
    onSuccess: onDone,
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>{article ? 'Modifier l’article' : 'Nouvel article'}</DialogTitle>
        <DialogDescription>
          Markdown : ## titre, - liste, 1. étapes, **gras**, *italique*, &gt; encadré, [lien](https://…).
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="doc-section">Section</FieldLabel>
              <Input id="doc-section" value={section} onChange={(e) => setSection(e.target.value)} placeholder="Ex. Terrain" />
            </Field>
            <Field data-invalid={!!slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)}>
              <FieldLabel htmlFor="doc-slug">Adresse</FieldLabel>
              <Input
                id="doc-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="ex. carte-temps-reel"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="doc-title">Titre</FieldLabel>
            <Input id="doc-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="doc-summary">Résumé</FieldLabel>
            <Input id="doc-summary" value={summary} maxLength={240} onChange={(e) => setSummary(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="doc-body">Contenu</FieldLabel>
            <Textarea id="doc-body" rows={16} className="font-mono text-xs" value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Lu par</FieldLabel>
            <div className="flex flex-wrap gap-4">
              {(Object.keys(AUDIENCE) as Audience[]).map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={audience.has(a)}
                    onCheckedChange={(on) => {
                      const next = new Set(audience)
                      if (on) next.add(a)
                      else next.delete(a)
                      setAudience(next)
                    }}
                  />
                  {AUDIENCE[a]}
                </label>
              ))}
            </div>
            <FieldDescription>Les administrateurs voient tout le manuel.</FieldDescription>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={published} onCheckedChange={setPublished} /> Publié
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Aperçu</p>
          <div className="min-h-64 rounded-lg border bg-background p-5">
            <h2 className="mb-1 text-xl font-semibold">{title || 'Titre'}</h2>
            {summary && <p className="mb-4 text-muted-foreground">{summary}</p>}
            <Markdown source={body} internalLinks={false} />
          </div>
        </div>
      </div>
      <DialogFooter className="sm:justify-between">
        {article ? (
          <Button variant="ghost" className="text-destructive" disabled={remove.isPending} onClick={() => remove.mutate(undefined)}>
            <Trash2 aria-hidden /> Supprimer
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDone}>
            Annuler
          </Button>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate(undefined)}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Enregistrer
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
