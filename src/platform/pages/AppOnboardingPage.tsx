import { OnboardingAnimation, type AppOnboardingEditor, type AppOnboardingEditorSlide } from '@suivi/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  FileJson,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Page, PageHeader, QueryState } from '@/components/app/page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { platformApi } from '../api'
import { LottiePlayer } from '../lottie-player'
import { ANIMATIONS, APP_COLOR, recolor } from '../onboarding-lottie'

type Slide = AppOnboardingEditorSlide
const KEY = ['platform', 'app-onboarding']
const MAX_SLIDES = 6

/**
 * Onboarding de l'app mobile : pages montrées avant la connexion (au premier lancement, puis
 * une fois à chaque nouvelle version). Aperçu façon téléphone avec les animations.
 */
export function AppOnboardingPage() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => (await platformApi.get<AppOnboardingEditor>('/app-onboarding')).data,
  })
  const apply = (result: { data: AppOnboardingEditor }) => queryClient.setQueryData(KEY, result.data)
  const [editing, setEditing] = useState<Slide | 'new' | null>(null)
  const [confirm, setConfirm] = useState<'republish' | 'restore' | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const setEnabled = useApiMutation((enabled: boolean) => platformApi.put<AppOnboardingEditor>('/app-onboarding', { enabled }), {
    onSuccess: apply,
  })
  const reorder = useApiMutation((ids: string[]) => platformApi.put<AppOnboardingEditor>('/app-onboarding/order', { ids }), {
    onSuccess: apply,
  })
  const remove = useApiMutation((id: string) => platformApi.delete<AppOnboardingEditor>(`/app-onboarding/slides/${id}`), {
    success: 'Page supprimée',
    onSuccess: apply,
  })
  const republish = useApiMutation(() => platformApi.post<AppOnboardingEditor>('/app-onboarding/republish'), {
    success: 'Nouvelle version publiée : l’onboarding sera remontré à tous',
    onSuccess: (r) => {
      apply(r)
      setConfirm(null)
    },
  })
  const restore = useApiMutation(() => platformApi.post<AppOnboardingEditor>('/app-onboarding/restore-defaults'), {
    success: 'Pages d’origine réinstallées',
    onSuccess: (r) => {
      apply(r)
      setConfirm(null)
    },
  })

  const data = query.data
  const slides = data?.slides ?? []
  const move = (index: number, delta: number) => {
    const ids = slides.map((s) => s.id)
    ;[ids[index], ids[index + delta]] = [ids[index + delta], ids[index]]
    reorder.mutate(ids)
  }

  return (
    <Page>
      <PageHeader
        title="Onboarding de l’app"
        description="Les pages présentées au premier lancement de l’app mobile, avant la connexion. Modifiez-les librement : republiez pour les remontrer à tous."
        actions={
          <>
            <Button variant="outline" onClick={() => setConfirm('restore')}>
              <RotateCcw aria-hidden /> Pages d’origine
            </Button>
            <Button onClick={() => setConfirm('republish')}>
              <Send aria-hidden /> Republier pour tous
            </Button>
          </>
        }
      />
      <QueryState query={query}>
        {data && (
          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div className="flex min-w-0 flex-col gap-4">
              <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border bg-card p-4">
                <label className="flex items-center gap-3 text-sm font-medium">
                  <Switch checked={data.enabled} disabled={setEnabled.isPending} onCheckedChange={(v) => setEnabled.mutate(v)} />
                  Afficher l’onboarding dans l’app
                </label>
                <p className="text-sm text-muted-foreground">
                  Version {data.version}
                  {data.publishedAt && ` · republiée le ${formatDateTime(data.publishedAt)}`}
                </p>
              </section>

              <ol className="flex flex-col gap-2" aria-label="Pages de l’onboarding">
                {slides.map((s, i) => (
                  <li
                    key={s.id}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors',
                      previewId === s.id && 'border-primary/50 ring-3 ring-primary/10',
                      !s.isActive && 'bg-muted/40',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewId(s.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none"
                      aria-label={`Voir l’aperçu : ${s.title}`}
                    >
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white tabular-nums"
                        style={{ backgroundColor: s.color ?? APP_COLOR }}
                      >
                        {i + 1}
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className={cn('truncate text-sm font-medium', !s.isActive && 'text-muted-foreground')}>{s.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{s.body}</span>
                        <span className="flex flex-wrap gap-1.5 pt-0.5">
                          <Badge variant="secondary">{s.lottieUrl ? 'Animation importée' : ANIMATIONS[s.animation].label}</Badge>
                          {!s.isActive && (
                            <Badge variant="outline">
                              <EyeOff aria-hidden /> Masquée
                            </Badge>
                          )}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Monter"
                        disabled={i === 0 || reorder.isPending}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Descendre"
                        disabled={i === slides.length - 1 || reorder.isPending}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown aria-hidden />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Modifier" onClick={() => setEditing(s)}>
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Supprimer"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(s.id)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
              <Button variant="outline" className="self-start" disabled={slides.length >= MAX_SLIDES} onClick={() => setEditing('new')}>
                <Plus aria-hidden /> Ajouter une page
              </Button>
              {slides.length >= MAX_SLIDES && <p className="text-xs text-muted-foreground">{MAX_SLIDES} pages au plus.</p>}
            </div>

            <PhonePreview slides={slides.filter((s) => s.isActive)} currentId={previewId} onChange={setPreviewId} enabled={data.enabled} />
          </div>
        )}
      </QueryState>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          {editing && (
            <SlideForm
              slide={editing === 'new' ? null : editing}
              onSaved={(r) => {
                queryClient.setQueryData(KEY, r)
                setEditing(null)
              }}
              onUpdated={(r) => {
                queryClient.setQueryData(KEY, r)
                const updated = r.slides.find((s) => editing !== 'new' && s.id === editing.id)
                if (updated) setEditing(updated)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm === 'republish' ? 'Republier l’onboarding ?' : 'Réinstaller les pages d’origine ?'}</DialogTitle>
            <DialogDescription>
              {confirm === 'republish'
                ? 'Tous les utilisateurs de l’app le reverront une fois, à leur prochaine ouverture. À réserver aux changements importants.'
                : 'Les pages actuelles et leurs animations importées seront remplacées par les 3 pages d’origine.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Annuler
            </Button>
            {confirm === 'republish' ? (
              <Button disabled={republish.isPending} onClick={() => republish.mutate(undefined)}>
                {republish.isPending && <Loader2 className="animate-spin" aria-hidden />} Republier
              </Button>
            ) : (
              <Button variant="destructive" disabled={restore.isPending} onClick={() => restore.mutate(undefined)}>
                {restore.isPending && <Loader2 className="animate-spin" aria-hidden />} Réinstaller
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

/** Animation d'une page : importée, sinon fournie avec l'app, à la couleur d'accent. */
function SlideAnimation({ slide, className }: { slide: Pick<Slide, 'animation' | 'color' | 'lottieUrl'>; className?: string }) {
  const url = slide.lottieUrl ?? ANIMATIONS[slide.animation].file
  const query = useQuery({
    queryKey: ['lottie', url],
    queryFn: async () => (await fetch(url)).json() as Promise<Record<string, unknown>>,
    staleTime: Infinity,
  })
  const color = slide.color ?? APP_COLOR
  const data = useMemo(() => (query.data ? recolor(query.data, color) : null), [query.data, color])
  if (!data) return <div className={cn('aspect-square animate-pulse rounded-full bg-muted', className)} />
  return <LottiePlayer data={data} className={className} />
}

function PhonePreview({
  slides,
  currentId,
  onChange,
  enabled,
}: {
  slides: Slide[]
  currentId: string | null
  onChange: (id: string) => void
  enabled: boolean
}) {
  const index = Math.max(
    0,
    slides.findIndex((s) => s.id === currentId),
  )
  const slide = slides[index]
  const color = slide?.color ?? APP_COLOR
  const go = (delta: number) => {
    const next = slides[index + delta]
    if (next) onChange(next.id)
  }
  return (
    <aside className="flex flex-col items-center gap-3 lg:sticky lg:top-4 lg:self-start" aria-label="Aperçu dans l’app">
      <p className="flex items-center gap-1.5 self-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <Smartphone className="size-3.5" aria-hidden /> Aperçu
      </p>
      <div className="relative flex aspect-[9/19] w-full max-w-[18rem] flex-col overflow-hidden rounded-[2.5rem] border-8 border-foreground/90 bg-white text-zinc-900 shadow-xl">
        {!enabled && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/85 p-6 text-center text-sm text-zinc-600">
            Onboarding désactivé : l’app ouvre directement l’écran de connexion.
          </div>
        )}
        {slide ? (
          <>
            <div className="flex justify-end px-5 pt-6 text-xs font-medium text-zinc-500">Passer</div>
            <div className="flex flex-1 items-center justify-center px-6">
              <SlideAnimation key={slide.id + slide.color + slide.lottieUrl} slide={slide} className="w-full" />
            </div>
            <div className="flex flex-col gap-2 px-6 text-center">
              <p className="text-lg leading-tight font-bold text-balance">{slide.title}</p>
              <p className="text-[13px] leading-snug text-zinc-600">{slide.body}</p>
            </div>
            <div className="flex items-center justify-center gap-1.5 py-5" aria-hidden>
              {slides.map((s, i) => (
                <span
                  key={s.id}
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: i === index ? 18 : 6, backgroundColor: i === index ? color : '#d4d4d8' }}
                />
              ))}
            </div>
            <div className="px-6 pb-8">
              <div className="rounded-full py-3 text-center text-sm font-semibold text-white" style={{ backgroundColor: color }}>
                {index === slides.length - 1 ? 'Commencer' : 'Suivant'}
              </div>
            </div>
          </>
        ) : (
          <p className="m-auto p-6 text-center text-sm text-zinc-500">Aucune page affichée.</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" aria-label="Page précédente" disabled={index === 0} onClick={() => go(-1)}>
          <ChevronLeft aria-hidden />
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">{slides.length ? `${index + 1} / ${slides.length}` : '0 / 0'}</span>
        <Button variant="outline" size="icon-sm" aria-label="Page suivante" disabled={index >= slides.length - 1} onClick={() => go(1)}>
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </aside>
  )
}

function SlideForm({
  slide,
  onSaved,
  onUpdated,
}: {
  slide: Slide | null
  onSaved: (r: AppOnboardingEditor) => void
  onUpdated: (r: AppOnboardingEditor) => void
}) {
  const [title, setTitle] = useState(slide?.title ?? '')
  const [body, setBody] = useState(slide?.body ?? '')
  const [animation, setAnimation] = useState<OnboardingAnimation>(slide?.animation ?? OnboardingAnimation.Location)
  const [color, setColor] = useState<string | null>(slide?.color ?? null)
  const [isActive, setIsActive] = useState(slide?.isActive ?? true)
  const file = useRef<HTMLInputElement>(null)

  const valid = title.trim().length >= 2 && body.trim().length >= 2
  const save = useApiMutation(
    async () => {
      const payload = { title: title.trim(), body: body.trim(), animation, color, isActive }
      return slide
        ? (await platformApi.patch<AppOnboardingEditor>(`/app-onboarding/slides/${slide.id}`, payload)).data
        : (await platformApi.post<AppOnboardingEditor>('/app-onboarding/slides', payload)).data
    },
    { success: slide ? 'Page enregistrée' : 'Page ajoutée', onSuccess: onSaved },
  )
  const upload = useApiMutation(
    async (f: File) => {
      const form = new FormData()
      form.append('file', f)
      return (await platformApi.put<AppOnboardingEditor>(`/app-onboarding/slides/${slide!.id}/lottie`, form)).data
    },
    { success: 'Animation importée', onSuccess: onUpdated },
  )
  const clearLottie = useApiMutation(
    async () => (await platformApi.delete<AppOnboardingEditor>(`/app-onboarding/slides/${slide!.id}/lottie`)).data,
    { success: 'Animation importée retirée', onSuccess: onUpdated },
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle>{slide ? 'Modifier la page' : 'Nouvelle page'}</DialogTitle>
        <DialogDescription>Un titre court et une phrase qui donne envie : l’écran d’un téléphone est petit.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-5 sm:grid-cols-[1fr_11rem]">
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="slide-title">Titre</FieldLabel>
            <Input id="slide-title" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} />
            <FieldDescription>{title.length} / 60</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="slide-body">Texte</FieldLabel>
            <Textarea id="slide-body" rows={3} maxLength={220} value={body} onChange={(e) => setBody(e.target.value)} />
            <FieldDescription>{body.length} / 220</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Animation fournie</FieldLabel>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Animation fournie">
              {Object.values(OnboardingAnimation).map((a) => (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={animation === a}
                  onClick={() => setAnimation(a)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border p-2 text-xs font-medium transition-colors hover:bg-muted/50',
                    animation === a && 'border-primary ring-3 ring-primary/15',
                  )}
                >
                  <SlideAnimation slide={{ animation: a, color, lottieUrl: null }} className="size-16" />
                  {ANIMATIONS[a].label}
                </button>
              ))}
            </div>
            {slide?.lottieUrl && <FieldDescription>Remplacée dans l’app par l’animation importée ci-dessous.</FieldDescription>}
          </Field>
          <Field>
            <FieldLabel htmlFor="slide-color">Couleur d’accent</FieldLabel>
            <div className="flex flex-wrap items-center gap-3">
              <input
                id="slide-color"
                type="color"
                value={color ?? APP_COLOR}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
                className="h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1"
              />
              <span className="font-mono text-sm">{color ?? 'Couleur de l’app'}</span>
              {color && (
                <Button variant="ghost" size="sm" onClick={() => setColor(null)}>
                  Couleur de l’app
                </Button>
              )}
            </div>
          </Field>
          <label className="flex items-center gap-3 text-sm font-medium">
            <Switch checked={isActive} onCheckedChange={setIsActive} /> Page affichée
          </label>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Animation importée</p>
          {slide ? (
            <>
              {slide.lottieUrl ? (
                <div className="flex flex-col gap-2 rounded-lg border p-2">
                  <SlideAnimation slide={slide} className="w-full" />
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <FileJson className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{slide.lottieName}</span>
                  </p>
                  <Button variant="outline" size="sm" disabled={clearLottie.isPending} onClick={() => clearLottie.mutate(undefined)}>
                    <Trash2 aria-hidden /> Retirer
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Facultatif : un fichier Lottie (.json, 500 Ko au plus) remplace l’animation fournie. Nommez « accent » les formes à
                  recolorer.
                </p>
              )}
              <input
                ref={file}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) upload.mutate(f)
                  e.target.value = ''
                }}
              />
              <Button variant="outline" size="sm" disabled={upload.isPending} onClick={() => file.current?.click()}>
                {upload.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
                {slide.lottieUrl ? 'Remplacer' : 'Importer un Lottie'}
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Enregistrez la page pour pouvoir importer une animation Lottie.</p>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button disabled={!valid || save.isPending} onClick={() => save.mutate(undefined)}>
          {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
          {slide ? 'Enregistrer' : 'Ajouter la page'}
        </Button>
      </DialogFooter>
    </>
  )
}
