import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Page, PageHeader, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApiMutation } from '@/lib/queries'
import { platformApi } from '../api'
import { usePlans } from '../plans'
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
      <PageHeader title="Réglages de facturation" description="Règles communes à toutes les structures." />
      <QueryState query={query} rows={4}>
        {query.data && <Form settings={query.data} />}
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
