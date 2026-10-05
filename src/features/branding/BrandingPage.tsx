import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ImageUp, Loader2, MapPin, Phone, Play, Save, Smartphone, Target, Trash2, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Page, PageHeader, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { api, session } from '@/lib/api'
import { useApiMutation } from '@/lib/queries'
import type { Branding } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Couleurs proposées : contrastées et lisibles en plein soleil. */
const PRESETS = ['#2563EB', '#0F766E', '#15803D', '#B45309', '#B91C1C', '#7C3AED', '#0F172A', '#DB2777']

/** Contraste WCAG entre deux couleurs #RRGGBB. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}
const readableOn = (c: string) => (contrast(c, '#FFFFFF') >= contrast(c, '#0F172A') ? '#FFFFFF' : '#0F172A')
const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v)

/** Le logo est servi avec authentification : on le charge en blob pour l'aperçu. */
function useLogoObjectUrl(logoUrl: string | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!logoUrl) return
    let objectUrl: string | null = null
    let cancelled = false
    void fetch(logoUrl, { headers: { Authorization: `Bearer ${session.accessToken}` } })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [logoUrl])
  return logoUrl ? url : null
}

function PhonePreview({
  draft,
  logo,
}: {
  draft: { displayName: string; primaryColor: string; welcomeMessage: string }
  logo: string | null
}) {
  const color = isHex(draft.primaryColor) ? draft.primaryColor : '#2563EB'
  const on = readableOn(color)
  return (
    <figure className="mx-auto w-[280px]" aria-label="Aperçu de l'écran d'accueil de l'agent">
      <div className="overflow-hidden rounded-[2.2rem] border-[6px] border-slate-900 bg-slate-50 shadow-xl">
        <div className="flex h-6 items-center justify-center bg-slate-900">
          <span className="h-1.5 w-16 rounded-full bg-slate-700" />
        </div>
        <div className="px-4 pt-4 pb-5" style={{ background: color, color: on }}>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center overflow-hidden rounded-xl bg-white/90">
              {logo ? (
                <img src={logo} alt="" className="size-full object-contain p-0.5" />
              ) : (
                <MapPin className="size-4" style={{ color }} />
              )}
            </span>
            <span className="truncate text-sm font-semibold">{draft.displayName || 'Votre structure'}</span>
          </div>
          <p className="mt-4 text-xs opacity-80">Bonjour Koffi</p>
          <p className="text-lg font-semibold">Ma journée</p>
        </div>
        <div className="-mt-3 space-y-3 px-3 pb-4">
          {draft.welcomeMessage && (
            <p className="rounded-xl bg-white p-3 text-[11px] leading-snug text-slate-600 shadow-sm">{draft.welcomeMessage}</p>
          )}
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">Ma zone</p>
            <p className="text-sm font-semibold text-slate-900">Plateau</p>
            <p className="text-[11px] text-slate-500">Approuvée · 2 places restantes</p>
          </div>
          <div
            className="flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
            style={{ background: color, color: on }}
          >
            <Play className="size-4" /> Démarrer ma journée
          </div>
          <div className="flex justify-around border-t pt-2 text-[10px] text-slate-500">
            <span className="flex flex-col items-center gap-0.5 font-semibold" style={{ color }}>
              <MapPin className="size-4" /> Journée
            </span>
            <span className="flex flex-col items-center gap-0.5">
              <Target className="size-4" /> Missions
            </span>
            <span className="flex flex-col items-center gap-0.5">
              <User className="size-4" /> Profil
            </span>
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">Aperçu dans l'app de l'agent</figcaption>
    </figure>
  )
}

function BrandingForm({ branding }: { branding: Branding }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const logo = useLogoObjectUrl(branding.logoUrl)
  const [draft, setDraft] = useState({
    displayName: branding.displayName,
    primaryColor: branding.primaryColor,
    welcomeMessage: branding.welcomeMessage ?? '',
    supportPhone: branding.supportPhone ?? '',
  })
  const set = (k: keyof typeof draft, v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const validColor = isHex(draft.primaryColor)
  const lowContrast = validColor && contrast(draft.primaryColor, '#F8FAFC') < 3

  const save = useApiMutation(
    () =>
      api.patch('/branding', {
        displayName: draft.displayName,
        primaryColor: draft.primaryColor,
        welcomeMessage: draft.welcomeMessage,
        supportPhone: draft.supportPhone,
      }),
    { success: "Personnalisation enregistrée : elle s'applique à la prochaine ouverture de l'app", invalidate: [['branding']] },
  )
  const upload = useApiMutation(
    (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api.put('/branding/logo', form)
    },
    { success: 'Logo mis à jour', invalidate: [['branding']] },
  )
  const removeLogo = useApiMutation(() => api.delete('/branding/logo'), { success: 'Logo retiré', invalidate: [['branding']] })

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-5 rounded-lg border bg-card p-4 md:p-5">
        <Field>
          <FieldLabel>Logo</FieldLabel>
          <div className="flex items-center gap-3">
            <span className="flex size-16 items-center justify-center overflow-hidden rounded-xl border bg-muted">
              {logo ? (
                <img src={logo} alt="Logo actuel" className="size-full object-contain p-1" />
              ) : (
                <ImageUp className="size-5 text-muted-foreground" aria-hidden />
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
                {upload.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <ImageUp aria-hidden />}
                {branding.logoUrl ? 'Remplacer' : 'Ajouter un logo'}
              </Button>
              {branding.logoUrl && (
                <Button variant="ghost" size="sm" disabled={removeLogo.isPending} onClick={() => removeLogo.mutate(undefined)}>
                  <Trash2 aria-hidden /> Retirer
                </Button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-label="Fichier du logo"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) upload.mutate(file)
                e.target.value = ''
              }}
            />
          </div>
          <FieldDescription>PNG, JPEG ou WebP, 512 Ko maximum. Un logo carré sur fond transparent rend le mieux.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="b-name">Nom affiché</FieldLabel>
          <Input id="b-name" maxLength={40} value={draft.displayName} onChange={(e) => set('displayName', e.target.value)} />
          <FieldDescription>Laissez vide pour utiliser le nom de la structure.</FieldDescription>
        </Field>

        <Field data-invalid={!validColor}>
          <FieldLabel htmlFor="b-color">Couleur principale</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Couleur ${c}`}
                aria-pressed={draft.primaryColor.toUpperCase() === c}
                onClick={() => set('primaryColor', c)}
                className={cn(
                  'size-9 rounded-full border-2 border-white shadow ring-offset-2 transition-shadow',
                  draft.primaryColor.toUpperCase() === c && 'ring-2 ring-foreground',
                )}
                style={{ background: c }}
              />
            ))}
            <label className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Couleur personnalisée"
                value={validColor ? draft.primaryColor : '#2563eb'}
                onChange={(e) => set('primaryColor', e.target.value.toUpperCase())}
                className="size-9 cursor-pointer rounded-full border bg-transparent"
              />
            </label>
            <Input
              id="b-color"
              className="w-28 font-mono uppercase"
              value={draft.primaryColor}
              aria-invalid={!validColor}
              onChange={(e) => set('primaryColor', e.target.value)}
            />
          </div>
          {!validColor ? (
            <FieldDescription className="text-destructive">Format attendu : #RRGGBB</FieldDescription>
          ) : lowContrast ? (
            <p className="flex items-center gap-1.5 text-sm text-status-paused">
              <AlertTriangle className="size-4" aria-hidden /> Couleur très claire : peu visible en plein soleil. Préférez une teinte plus
              soutenue.
            </p>
          ) : (
            <FieldDescription>Le texte des boutons passe automatiquement en blanc ou en foncé pour rester lisible.</FieldDescription>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="b-welcome">Message d'accueil (facultatif)</FieldLabel>
          <Textarea
            id="b-welcome"
            rows={2}
            maxLength={160}
            value={draft.welcomeMessage}
            onChange={(e) => set('welcomeMessage', e.target.value)}
          />
          <FieldDescription>{draft.welcomeMessage.length}/160 · affiché sur l'écran « Ma journée ».</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="b-phone">Téléphone du responsable (facultatif)</FieldLabel>
          <div className="relative sm:w-64">
            <Phone className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="b-phone"
              type="tel"
              className="pl-8"
              value={draft.supportPhone}
              onChange={(e) => set('supportPhone', e.target.value)}
              placeholder="+225 07 00 00 00 00"
            />
          </div>
          <FieldDescription>Bouton « Appeler mon responsable » dans l'app.</FieldDescription>
        </Field>

        <div className="flex justify-end">
          <Button disabled={!validColor || save.isPending} onClick={() => save.mutate(undefined)}>
            {save.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            Enregistrer
          </Button>
        </div>
      </div>
      <PhonePreview draft={draft} logo={logo} />
    </div>
  )
}

export function BrandingPage() {
  const query = useQuery({ queryKey: ['branding'], queryFn: async () => (await api.get<Branding>('/branding')).data })
  return (
    <Page>
      <PageHeader
        title="Application mobile"
        description="Personnalisez l'app de vos agents. L'écran de connexion reste neutre : votre marque s'affiche dès que l'agent est connecté."
        actions={
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Smartphone className="size-4" aria-hidden /> Android et iOS
          </span>
        }
      />
      <QueryState query={query}>{query.data && <BrandingForm key={query.data.version} branding={query.data} />}</QueryState>
    </Page>
  )
}
