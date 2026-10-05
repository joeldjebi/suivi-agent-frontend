import type { LandingContent, LandingSection, LandingSectionType, PublicLanding } from '@suivi/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Check,
  CloudUpload,
  ExternalLink,
  Loader2,
  Monitor,
  Plus,
  RotateCcw,
  Smartphone,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { errorMessage } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { Landing } from '@/landing/Landing'
import { ScrollTrigger } from '@/landing/gsap'
import { ScrollRootContext } from '@/landing/motion'
import { platformApi } from '../api'
import { AreaField, Block, CtaField, TextField, ToggleField, VisualField } from '../site/fields'
import { SECTION_TYPES, SectionEditor, newSection, sectionTitle } from '../site/sections'

interface Editor {
  draft: LandingContent
  published: LandingContent | null
  publishedAt: string | null
  publishedBy: string | null
  updatedAt: string
  updatedBy: string | null
  hasChanges: boolean
}

type Save = 'idle' | 'saving' | 'saved' | 'error'

/** Site vitrine : édition du brouillon, aperçu en direct, publication. */
export function SitePage() {
  const editor = useQuery({
    queryKey: ['platform', 'landing'],
    queryFn: async () => (await platformApi.get<Editor>('/landing')).data,
    refetchOnWindowFocus: false,
  })
  // Formules du catalogue, devise et essai : pour l'aperçu fidèle.
  const catalog = useQuery({
    queryKey: ['platform', 'landing', 'preview'],
    queryFn: async () => (await platformApi.get<PublicLanding>('/landing/preview')).data,
    refetchOnWindowFocus: false,
  })
  return (
    <QueryState query={editor} rows={6}>
      {editor.data && catalog.data && <SiteEditor initial={editor.data} catalog={catalog.data} />}
    </QueryState>
  )
}

function SiteEditor({ initial, catalog }: { initial: Editor; catalog: PublicLanding }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState(initial)
  const [content, setContent] = useState(initial.draft)
  const [save, setSave] = useState<Save>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>('hero')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [confirm, setConfirm] = useState<'publish' | 'discard' | 'restore' | null>(null)
  const firstRender = useRef(true)

  // Enregistrement automatique du brouillon, une seconde après la dernière modification.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setSave('saving')
    const timer = setTimeout(async () => {
      try {
        const { data } = await platformApi.put<Editor>('/landing', { content })
        setState(data)
        setSave('saved')
        setSaveError(null)
      } catch (e) {
        setSave('error')
        setSaveError(errorMessage(e))
      }
    }, 900)
    return () => clearTimeout(timer)
  }, [content])

  const apply = (data: Editor) => {
    setState(data)
    firstRender.current = true
    setContent(data.draft)
    setSave('idle')
    queryClient.setQueryData(['platform', 'landing'], data)
  }
  const action = useApiMutation(
    async (kind: 'publish' | 'discard' | 'restore') =>
      (kind === 'publish'
        ? await platformApi.post<Editor>('/landing/publish')
        : kind === 'discard'
          ? await platformApi.delete<Editor>('/landing/draft')
          : await platformApi.post<Editor>('/landing/restore-defaults')
      ).data,
    {
      onSuccess: (data) => {
        const messages = {
          publish: 'Site publié : il est en ligne',
          discard: 'Modifications annulées',
          restore: 'Contenu d’origine restauré (à publier)',
        }
        toast.success(messages[confirm ?? 'publish'])
        apply(data)
        setConfirm(null)
      },
    },
  )

  const sections = content.sections
  const setSections = (next: LandingSection[]) => setContent({ ...content, sections: next })
  const updateSection = (i: number, s: LandingSection) => setSections(sections.map((x, j) => (j === i ? s : x)))
  const move = (i: number, d: -1 | 1) => {
    const next = [...sections]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    setSections(next)
  }
  const add = (type: LandingSectionType) => {
    const s = newSection(
      type,
      sections.map((x) => x.id),
    )
    setSections([...sections, s])
    setOpen(s.id)
  }

  // Cadre d'aperçu : les animations suivent son défilement, une fois qu'il existe.
  const [previewEl, setPreviewEl] = useState<HTMLDivElement | null>(null)
  const previewRef = useMemo(() => ({ current: previewEl }), [previewEl])
  const [previewHeight, setPreviewHeight] = useState(800)
  useEffect(() => {
    if (!previewEl) return
    const observer = new ResizeObserver(() => setPreviewHeight(previewEl.clientHeight))
    observer.observe(previewEl)
    return () => observer.disconnect()
  }, [previewEl])
  // Contenu, taille ou appareil changés : positions des animations recalculées.
  useEffect(() => {
    const timer = setTimeout(() => ScrollTrigger.refresh(), 400)
    return () => clearTimeout(timer)
  }, [content, device, previewHeight])

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2.5">
        <div className="mr-auto min-w-0">
          <h1 className="font-semibold">Site vitrine</h1>
          <p className="truncate text-xs text-muted-foreground">
            {state.publishedAt ? `En ligne depuis le ${formatDateTime(state.publishedAt)}` : 'Contenu d’origine en ligne'}
            {' · '}
            <SaveStatus save={save} error={saveError} dirty={state.hasChanges} />
          </p>
        </div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<a href="/" target="_blank" rel="noopener" />}>
          <ExternalLink aria-hidden /> Voir le site
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirm('restore')}>
          <RotateCcw aria-hidden /> Contenu d’origine
        </Button>
        <Button variant="outline" size="sm" disabled={!state.hasChanges || save === 'saving'} onClick={() => setConfirm('discard')}>
          <Undo2 aria-hidden /> Annuler les modifications
        </Button>
        <Button size="sm" disabled={!state.hasChanges || save === 'saving' || save === 'error'} onClick={() => setConfirm('publish')}>
          <CloudUpload aria-hidden /> Publier
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[24rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col gap-2 overflow-y-auto border-r bg-muted/30 p-3" aria-label="Contenu du site">
          <Block
            title="Identité et référencement"
            subtitle={content.brand.name}
            open={open === 'brand'}
            onToggle={() => setOpen(open === 'brand' ? null : 'brand')}
          >
            <TextField
              label="Nom"
              value={content.brand.name}
              max={40}
              onChange={(name) => setContent({ ...content, brand: { ...content.brand, name } })}
            />
            <TextField
              label="Signature"
              value={content.brand.tagline}
              max={120}
              onChange={(tagline) => setContent({ ...content, brand: { ...content.brand, tagline } })}
            />
            <TextField
              label="Titre pour Google"
              value={content.seo.title}
              max={70}
              onChange={(title) => setContent({ ...content, seo: { ...content.seo, title } })}
            />
            <AreaField
              label="Description pour Google"
              rows={3}
              value={content.seo.description}
              max={170}
              onChange={(description) => setContent({ ...content, seo: { ...content.seo, description } })}
            />
          </Block>

          <Block
            title="En-tête"
            subtitle={content.hero.title.replace(/\n/g, ' ')}
            open={open === 'hero'}
            onToggle={() => setOpen(open === 'hero' ? null : 'hero')}
          >
            <TextField
              label="Pastille"
              value={content.hero.eyebrow}
              max={60}
              onChange={(eyebrow) => setContent({ ...content, hero: { ...content.hero, eyebrow } })}
            />
            <AreaField
              label="Grand titre"
              rows={2}
              value={content.hero.title}
              max={100}
              hint="Un retour à la ligne crée une nouvelle ligne du titre."
              onChange={(title) => setContent({ ...content, hero: { ...content.hero, title } })}
            />
            <AreaField
              label="Sous-titre"
              value={content.hero.subtitle}
              max={300}
              onChange={(subtitle) => setContent({ ...content, hero: { ...content.hero, subtitle } })}
            />
            <CtaField
              label="Bouton principal"
              value={content.hero.primary}
              onChange={(primary) => setContent({ ...content, hero: { ...content.hero, primary } })}
            />
            <ToggleField
              label="Second bouton"
              checked={!!content.hero.secondary}
              onChange={(on) =>
                setContent({ ...content, hero: { ...content.hero, secondary: on ? { label: 'Demander une démo', action: 'demo' } : null } })
              }
            />
            {content.hero.secondary && (
              <CtaField
                label="Second bouton"
                value={content.hero.secondary}
                onChange={(secondary) => setContent({ ...content, hero: { ...content.hero, secondary } })}
              />
            )}
            <VisualField
              visual={content.hero.visual}
              imageId={content.hero.imageId}
              onChange={(visual, imageId) => setContent({ ...content, hero: { ...content.hero, visual, imageId } })}
            />
          </Block>

          <div className="mt-2 flex items-center justify-between px-1">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Sections ({sections.length})</p>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
                <Plus aria-hidden /> Ajouter
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(SECTION_TYPES) as LandingSectionType[]).map((t) => (
                  <DropdownMenuItem key={t} onClick={() => add(t)}>
                    {SECTION_TYPES[t]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {sections.map((s, i) => (
            <Block
              key={s.id}
              title={sectionTitle(s)}
              subtitle={`${SECTION_TYPES[s.type]}${s.enabled ? '' : ' · masquée'}`}
              open={open === s.id}
              muted={!s.enabled}
              onToggle={() => setOpen(open === s.id ? null : s.id)}
              actions={
                <div className="flex shrink-0 items-center">
                  <Switch
                    checked={s.enabled}
                    aria-label={s.enabled ? 'Masquer la section' : 'Afficher la section'}
                    onCheckedChange={(enabled) => updateSection(i, { ...s, enabled })}
                    className="mr-1 scale-90"
                  />
                  <Button variant="ghost" size="icon-xs" aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Descendre"
                    disabled={i === sections.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Supprimer la section"
                    onClick={() => setSections(sections.filter((_, j) => j !== i))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              }
            >
              <SectionEditor section={s} onChange={(next) => updateSection(i, next)} />
            </Block>
          ))}

          <Block title="Pied de page" open={open === 'footer'} onToggle={() => setOpen(open === 'footer' ? null : 'footer')}>
            <AreaField
              label="Texte"
              rows={2}
              value={content.footer.text}
              max={200}
              onChange={(text) => setContent({ ...content, footer: { ...content.footer, text } })}
            />
            <TextField
              label="Email"
              value={content.footer.email}
              max={120}
              onChange={(email) => setContent({ ...content, footer: { ...content.footer, email } })}
            />
            <TextField
              label="Téléphone"
              value={content.footer.phone}
              max={30}
              onChange={(phone) => setContent({ ...content, footer: { ...content.footer, phone } })}
            />
            <TextField
              label="Adresse"
              value={content.footer.address}
              max={120}
              onChange={(address) => setContent({ ...content, footer: { ...content.footer, address } })}
            />
          </Block>
        </aside>

        <section className="flex min-h-0 flex-col bg-neutral-200/60" aria-label="Aperçu">
          <div className="flex items-center justify-center gap-1 border-b bg-card py-1.5">
            {(
              [
                ['desktop', Monitor, 'Ordinateur'],
                ['mobile', Smartphone, 'Mobile'],
              ] as const
            ).map(([d, Icon, label]) => (
              <Button
                key={d}
                variant={device === d ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={device === d}
                onClick={() => setDevice(d)}
              >
                <Icon aria-hidden /> {label}
              </Button>
            ))}
            <span className="ml-3 text-xs text-muted-foreground">Aperçu du brouillon, boutons inactifs</span>
          </div>
          <div className="flex min-h-0 flex-1 justify-center overflow-hidden p-3">
            <div
              ref={setPreviewEl}
              className={cn(
                'relative h-full overflow-y-auto rounded-xl bg-white shadow-xl ring-1 ring-black/10 transition-[width] duration-300',
                device === 'mobile' ? 'w-[390px]' : 'w-full',
              )}
              style={{ '--landing-vh': `${previewHeight}px` } as React.CSSProperties}
            >
              {previewEl && (
                <ScrollRootContext.Provider value={previewRef}>
                  <Landing
                    data={{ ...catalog, content }}
                    onAction={() => toast.info('Aperçu : les boutons sont actifs sur le site publié.')}
                  />
                </ScrollRootContext.Provider>
              )}
            </div>
          </div>
        </section>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirm === 'publish'
                ? 'Publier le site ?'
                : confirm === 'discard'
                  ? 'Annuler les modifications ?'
                  : 'Revenir au contenu d’origine ?'}
            </DialogTitle>
            <DialogDescription>
              {confirm === 'publish'
                ? 'Le brouillon devient la version en ligne. Les visiteurs le voient dans la minute.'
                : confirm === 'discard'
                  ? 'Le brouillon est abandonné : l’éditeur repart de la version en ligne.'
                  : 'Le contenu installé avec la plateforme remplace le brouillon. Il ne sera en ligne qu’après publication.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Retour
            </Button>
            <Button
              variant={confirm === 'publish' ? 'default' : 'destructive'}
              disabled={action.isPending}
              onClick={() => confirm && action.mutate(confirm)}
            >
              {confirm === 'publish' ? 'Publier' : confirm === 'discard' ? 'Annuler les modifications' : 'Restaurer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SaveStatus({ save, error, dirty }: { save: Save; error: string | null; dirty: boolean }) {
  if (save === 'saving')
    return (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="size-3 animate-spin" aria-hidden /> Enregistrement du brouillon…
      </span>
    )
  if (save === 'error') return <span className="text-destructive">Brouillon non enregistré : {error}</span>
  if (dirty)
    return (
      <span className="inline-flex items-center gap-1 text-status-paused">
        <Check className="size-3" aria-hidden /> Brouillon enregistré, pas encore publié
      </span>
    )
  return <span>À jour</span>
}
