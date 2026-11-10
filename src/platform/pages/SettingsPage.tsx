import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Page, PageHeader, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatMoney } from '../labels'
import { useApiMutation } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { platformApi } from '../api'
import { usePlans } from '../plans'
import { PhotoAiProviderForm } from './PhotoAiProviderForm'
import type { PlatformSettings } from '../types'

const FIELDS = [
  {
    key: 'trialDays',
    label: 'Durée de l’essai gratuit',
    unit: 'jours',
    hint: 'Pour les nouvelles inscriptions. 0 à 90 jours.',
    min: 0,
    max: 90,
  },
  {
    key: 'annualDiscountPercent',
    label: 'Remise sur l’engagement annuel',
    unit: '%',
    hint: 'Déduite de chaque facture mensuelle. 0 à 50 %.',
    min: 0,
    max: 50,
  },
  {
    key: 'invoiceDueDays',
    label: 'Échéance des factures',
    unit: 'jours',
    hint: 'Délai de paiement après l’émission. 1 à 90 jours.',
    min: 1,
    max: 90,
  },
  {
    key: 'suspendAfterDays',
    label: 'Suspension après échéance',
    unit: 'jours',
    hint: 'Une facture impayée passe la structure « en retard », puis la suspend après ce délai. 1 à 90 jours.',
    min: 1,
    max: 90,
  },
] as const

type Key = (typeof FIELDS)[number]['key']

export function SettingsPage() {
  const query = useQuery({
    queryKey: ['platform', 'settings'],
    queryFn: async () => (await platformApi.get<PlatformSettings>('/settings')).data,
  })
  return (
    <Page>
      <PageHeader title="Réglages" description="Règles communes à toutes les structures." />
      <QueryState query={query} rows={4}>
        {query.data && (
          <>
            <h2 className="text-base font-semibold">Facturation</h2>
            <Form settings={query.data} />
            <h2 className="mt-4 text-base font-semibold">Mise en place</h2>
            <OnboardingPackagesForm settings={query.data} />
            <h2 className="mt-4 text-base font-semibold">Application mobile</h2>
            <AppVersionForm settings={query.data} />
            <h2 className="mt-4 text-base font-semibold">IA photo</h2>
            <PhotoAiProviderForm />
          </>
        )}
      </QueryState>
    </Page>
  )
}

function Form({ settings }: { settings: PlatformSettings }) {
  const initial = () => Object.fromEntries(FIELDS.map((f) => [f.key, String(settings[f.key])])) as Record<Key, string>
  const [v, setV] = useState(initial)
  const plans = usePlans()
  const offered = plans.data?.filter((p) => p.isActive) ?? []
  const [trialPlan, setTrialPlan] = useState(settings.trialPlanCode)
  const [defaultPlan, setDefaultPlan] = useState(settings.defaultPlanCode)
  const changed =
    FIELDS.some((f) => v[f.key] !== String(settings[f.key])) ||
    trialPlan !== settings.trialPlanCode ||
    defaultPlan !== settings.defaultPlanCode
  const valid = FIELDS.every((f) => v[f.key] !== '' && Number(v[f.key]) >= f.min && Number(v[f.key]) <= f.max)
  const save = useApiMutation(
    () =>
      platformApi.patch('/settings', {
        ...Object.fromEntries(FIELDS.map((f) => [f.key, Number(v[f.key])])),
        trialPlanCode: trialPlan,
        defaultPlanCode: defaultPlan,
      }),
    {
      success: 'Réglages enregistrés',
      invalidate: [['platform']],
    },
  )
  return (
    <div className="max-w-2xl rounded-lg border bg-card">
      <div className="divide-y">
        {FIELDS.map((f) => {
          const value = Number(v[f.key])
          const invalid = v[f.key] === '' || value < f.min || value > f.max
          return (
            <div key={f.key} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center">
              <div>
                <Label htmlFor={f.key}>{f.label}</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">{f.hint}</p>
              </div>
              <div className="relative">
                <Input
                  id={f.key}
                  inputMode="numeric"
                  aria-invalid={invalid}
                  value={v[f.key]}
                  onChange={(e) => setV({ ...v, [f.key]: e.target.value.replace(/\D/g, '') })}
                  className="pr-14"
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                  {f.unit}
                </span>
              </div>
            </div>
          )
        })}
        {(
          [
            {
              id: 'trial-plan',
              label: 'Quotas de l’essai gratuit',
              hint: 'Pendant l’essai, toutes les fonctionnalités sont ouvertes avec les quotas de cette formule.',
              value: trialPlan,
              set: setTrialPlan,
            },
            {
              id: 'default-plan',
              label: 'Formule après l’essai',
              hint: 'Attribuée aux nouvelles structures ; elle s’applique à la fin de leur essai si elles n’en choisissent pas une autre.',
              value: defaultPlan,
              set: setDefaultPlan,
            },
          ] as const
        ).map((f) => (
          <div key={f.id} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-center">
            <div>
              <Label id={`${f.id}-label`}>{f.label}</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">{f.hint}</p>
            </div>
            <Select value={f.value} onValueChange={(x) => x && f.set(x)}>
              <SelectTrigger className="w-full" aria-labelledby={`${f.id}-label`}>
                <SelectValue>{(x: string) => plans.data?.find((p) => p.code === x)?.name ?? x}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {offered.map((p) => (
                  <SelectItem key={p.code} value={p.code}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        <div className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center">
          <div>
            <p className="text-sm font-medium">Devise</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Fixée à l’installation de la plateforme.</p>
          </div>
          <p className="text-sm font-medium">{settings.currency === 'XOF' ? 'Franc CFA (XOF)' : settings.currency}</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t p-3">
        <Button
          variant="outline"
          disabled={!changed}
          onClick={() => {
            setV(initial())
            setTrialPlan(settings.trialPlanCode)
            setDefaultPlan(settings.defaultPlanCode)
          }}
        >
          Annuler
        </Button>
        <Button disabled={!changed || !valid || save.isPending} onClick={() => save.mutate(undefined)}>
          Enregistrer
        </Button>
      </div>
    </div>
  )
}

/** Code d'un forfait tiré de son nom : minuscules, chiffres, tirets (unique dans la liste). */
const packageCode = (name: string, taken: string[]) => {
  const base =
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'forfait'
  let code = base.length >= 2 ? base : `${base}-1`
  for (let i = 2; taken.includes(code); i++) code = `${base}-${i}`
  return code
}

interface PackageRow {
  /** Vide pour un forfait pas encore enregistré : tiré du nom à l'enregistrement */
  code: string
  name: string
  description: string
  price: string
  discountPercent: string
}

/**
 * Forfaits de mise en place (formation, import, configuration) : affichés sur le site et dans la
 * page Abonnement des structures ; vous les ajoutez à la facture d'une structure depuis sa fiche.
 */
function OnboardingPackagesForm({ settings }: { settings: PlatformSettings }) {
  const initial = (): PackageRow[] =>
    settings.onboardingPackages.map((p) => ({
      ...p,
      price: String(p.price),
      discountPercent: String(p.discountPercent ?? 0),
    }))
  const [rows, setRows] = useState(initial)
  const changed = JSON.stringify(rows) !== JSON.stringify(initial())
  const valid = rows.every((r) => r.name.trim() && r.price !== '')
  const set = (i: number, patch: Partial<PackageRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const save = useApiMutation(
    () => {
      const taken: string[] = rows.filter((r) => r.code).map((r) => r.code)
      return platformApi.patch('/settings', {
        onboardingPackages: rows.map((r) => {
          const code = r.code || packageCode(r.name, taken)
          taken.push(code)
          return {
            code,
            name: r.name.trim(),
            description: r.description.trim(),
            price: Number(r.price),
            discountPercent: Number(r.discountPercent) || 0,
          }
        }),
      })
    },
    { success: 'Forfaits de mise en place enregistrés', invalidate: [['platform']] },
  )
  return (
    <div className="max-w-2xl rounded-lg border bg-card">
      <p className="border-b p-4 text-xs text-muted-foreground">
        Proposés sur le site et dans la page Abonnement des structures. Pour en facturer un, ouvrez la fiche de la structure :
        il s’ajoute à sa prochaine facture. Un changement de prix ne touche pas les frais déjà ajoutés.
      </p>
      <ul className="divide-y">
        {rows.map((r, i) => (
          <li key={i} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_auto] sm:items-start">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`pkg-name-${i}`}>Nom</Label>
              <Input
                id={`pkg-name-${i}`}
                value={r.name}
                maxLength={60}
                aria-invalid={!r.name.trim()}
                onChange={(e) => set(i, { name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`pkg-price-${i}`}>Prix (FCFA)</Label>
              <Input
                id={`pkg-price-${i}`}
                inputMode="numeric"
                value={r.price}
                aria-invalid={r.price === ''}
                onChange={(e) => set(i, { price: e.target.value.replace(/\D/g, '') })}
              />
              {r.price !== '' && <p className="text-xs text-muted-foreground">{formatMoney(Number(r.price))}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`pkg-discount-${i}`}>Réduction (%)</Label>
              <Input
                id={`pkg-discount-${i}`}
                inputMode="numeric"
                value={r.discountPercent}
                onChange={(e) => set(i, { discountPercent: e.target.value.replace(/\D/g, '').slice(0, 3) })}
              />
              {r.price !== '' && Number(r.discountPercent) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Facturé : {formatMoney(Math.round(Number(r.price) * (1 - Math.min(100, Number(r.discountPercent)) / 100)))}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="sm:mt-6"
              aria-label={`Retirer le forfait ${r.name || i + 1}`}
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
            >
              <Trash2 aria-hidden />
            </Button>
            <div className="flex flex-col gap-1.5 sm:col-span-3">
              <Label htmlFor={`pkg-desc-${i}`}>Ce qui est compris</Label>
              <Textarea
                id={`pkg-desc-${i}`}
                rows={2}
                maxLength={300}
                value={r.description}
                onChange={(e) => set(i, { description: e.target.value })}
              />
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="p-4 text-sm text-muted-foreground">Aucun forfait proposé.</li>}
      </ul>
      <div className="flex flex-wrap justify-between gap-2 border-t p-3">
        <Button
          variant="outline"
          disabled={rows.length >= 10}
          onClick={() => setRows([...rows, { code: '', name: '', description: '', price: '', discountPercent: '0' }])}
        >
          <Plus aria-hidden /> Ajouter un forfait
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!changed} onClick={() => setRows(initial())}>
            Annuler
          </Button>
          <Button disabled={!changed || !valid || save.isPending} onClick={() => save.mutate(undefined)}>
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  )
}

const VERSION = /^\d+\.\d+\.\d+$/
const URL_PATTERN = /^https?:\/\/\S+$/

type Importance = PlatformSettings['appUpdateImportance']

const IMPORTANCE: { value: Importance; label: string; hint: string }[] = [
  { value: 'minor', label: 'Mineure', hint: 'Fenêtre qu’on peut fermer, proposée de nouveau une fois par jour.' },
  { value: 'recommended', label: 'Recommandée', hint: 'Fenêtre qu’on peut fermer, proposée de nouveau toutes les heures.' },
  { value: 'critical', label: 'Critique', hint: 'Mise à jour obligatoire : l’app reste bloquée tant qu’elle n’est pas faite.' },
]

/** Versions de l'app mobile, importance de la mise à jour et liens de téléchargement. */
function AppVersionForm({ settings }: { settings: PlatformSettings }) {
  const initial = () => ({
    latestAppVersion: settings.latestAppVersion ?? '',
    appUpdateImportance: settings.appUpdateImportance,
    appReleaseNotes: settings.appReleaseNotes ?? '',
    minAppVersion: settings.minAppVersion ?? '',
    androidStoreUrl: settings.androidStoreUrl ?? '',
    iosStoreUrl: settings.iosStoreUrl ?? '',
  })
  const [v, setV] = useState(initial)
  const critical = v.appUpdateImportance === 'critical'
  const fields = [
    {
      key: 'minAppVersion',
      label: 'Version minimale',
      hint: critical
        ? 'Réglée sur la dernière version : la mise à jour est critique.'
        : 'En dessous, l’app est bloquée et demande la mise à jour (ex. 1.2.0). Vide : rien n’est imposé.',
      placeholder: '1.2.0',
      pattern: VERSION,
    },
    {
      key: 'androidStoreUrl',
      label: 'Lien Android',
      hint: 'Play Store ou fichier APK à télécharger.',
      placeholder: 'https://play.google.com/store/apps/details?id=ci.suiviagent.suivi_agent',
      pattern: URL_PATTERN,
    },
    {
      key: 'iosStoreUrl',
      label: 'Lien iPhone',
      hint: 'App Store ou TestFlight.',
      placeholder: 'https://apps.apple.com/app/…',
      pattern: URL_PATTERN,
    },
  ] as const
  const latestInvalid = v.latestAppVersion !== '' && !VERSION.test(v.latestAppVersion.trim())
  const invalid = (k: (typeof fields)[number]) => v[k.key] !== '' && !k.pattern.test(v[k.key].trim())
  const changed = (Object.keys(v) as (keyof typeof v)[]).some((k) => v[k] !== initial()[k])
  const missingLatest = v.appUpdateImportance !== 'minor' && v.latestAppVersion.trim() === ''
  const valid = !latestInvalid && fields.every((f) => !invalid(f)) && !missingLatest && v.appReleaseNotes.length <= 500
  const missingLink = (v.minAppVersion !== '' || critical) && !v.androidStoreUrl && !v.iosStoreUrl
  const save = useApiMutation(
    () =>
      platformApi.patch(
        '/settings',
        Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'appUpdateImportance' ? x : x.trim() === '' ? null : x.trim()])),
      ),
    { success: 'Réglages de l’app enregistrés', invalidate: [['platform']] },
  )
  return (
    <div className="max-w-2xl rounded-lg border bg-card">
      <div className="divide-y">
        <div className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_18rem] sm:items-center">
          <div>
            <Label htmlFor="latestAppVersion">Dernière version publiée</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Dès l’enregistrement, les apps ouvertes plus anciennes affichent la fenêtre de mise à jour.
            </p>
          </div>
          <div>
            <Input
              id="latestAppVersion"
              value={v.latestAppVersion}
              placeholder="1.3.0"
              aria-invalid={latestInvalid || missingLatest}
              inputMode="decimal"
              onChange={(e) => setV({ ...v, latestAppVersion: e.target.value })}
            />
            {latestInvalid && <p className="mt-1 text-xs text-destructive">Format attendu : 1.2.0</p>}
            {missingLatest && <p className="mt-1 text-xs text-destructive">Indiquez la version concernée.</p>}
          </div>
        </div>
        <fieldset className="flex flex-col gap-2 p-4">
          <legend className="sr-only">Importance de la mise à jour</legend>
          <p className="text-sm font-medium" aria-hidden>
            Importance de la mise à jour
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {IMPORTANCE.map((o) => (
              <label
                key={o.value}
                className={cn(
                  'flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring',
                  v.appUpdateImportance === o.value
                    ? o.value === 'critical'
                      ? 'border-destructive bg-destructive/5'
                      : 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50',
                )}
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="appUpdateImportance"
                    value={o.value}
                    checked={v.appUpdateImportance === o.value}
                    onChange={() =>
                      setV({
                        ...v,
                        appUpdateImportance: o.value,
                        minAppVersion: o.value === 'critical' && v.latestAppVersion.trim() ? v.latestAppVersion.trim() : v.minAppVersion,
                      })
                    }
                    className="accent-primary"
                  />
                  {o.label}
                </span>
                <span className="text-xs text-muted-foreground">{o.hint}</span>
              </label>
            ))}
          </div>
          {critical && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Ne choisissez « Critique » qu’une fois la nouvelle version validée et disponible sur l’App Store et Google Play : sinon, les
              agents seront bloqués sans pouvoir mettre à jour.
            </p>
          )}
        </fieldset>
        <div className="flex flex-col gap-1.5 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor="appReleaseNotes">Nouveautés</Label>
            <span className={cn('text-xs tabular-nums', v.appReleaseNotes.length > 500 ? 'text-destructive' : 'text-muted-foreground')}>
              {v.appReleaseNotes.length}/500
            </span>
          </div>
          <Textarea
            id="appReleaseNotes"
            rows={3}
            value={v.appReleaseNotes}
            placeholder="Ex. : envoi des commandes plus rapide, correction de la carte de la zone."
            onChange={(e) => setV({ ...v, appReleaseNotes: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Affichées dans la fenêtre de mise à jour de l’app. Phrases courtes, sans jargon.</p>
        </div>
        {fields.map((f) => (
          <div key={f.key} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_18rem] sm:items-center">
            <div>
              <Label htmlFor={f.key}>{f.label}</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">{f.hint}</p>
            </div>
            <div>
              <Input
                id={f.key}
                value={v[f.key]}
                placeholder={f.placeholder}
                aria-invalid={invalid(f)}
                disabled={f.key === 'minAppVersion' && critical}
                inputMode={f.pattern === VERSION ? 'decimal' : 'url'}
                onChange={(e) => setV({ ...v, [f.key]: e.target.value })}
              />
              {invalid(f) && (
                <p className="mt-1 text-xs text-destructive">
                  {f.pattern === VERSION ? 'Format attendu : 1.2.0' : 'Adresse commençant par https://'}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      {missingLink && (
        <p className="border-t px-4 py-3 text-sm text-status-paused">
          Ajoutez au moins un lien : sinon, les agents bloqués ne sauront pas où télécharger la nouvelle version.
        </p>
      )}
      <div className="flex justify-end gap-2 border-t p-3">
        <Button variant="outline" disabled={!changed} onClick={() => setV(initial())}>
          Annuler
        </Button>
        <Button disabled={!changed || !valid || save.isPending} onClick={() => save.mutate(undefined)}>
          Enregistrer
        </Button>
      </div>
    </div>
  )
}
