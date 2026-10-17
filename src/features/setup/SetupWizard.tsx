import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  ClipboardList,
  Copy,
  HandCoins,
  Loader2,
  MapPin,
  Plus,
  Printer,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  Users,
  Wrench,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, Polygon, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { BaseMap, FitZones } from '@/components/map/base-map'
import { toLatLngs } from '@/components/map/geo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api, errorMessage } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatPhone } from '@/lib/format'
import type { Zone } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Area {
  key: string
  name: string
  area: Zone['area']
}

interface Catalog {
  activities: { key: string; label: string; description: string; examples: string; fields: { label: string; type: string }[] }[]
  cities: { key: string; name: string; center: { lat: number; lng: number }; areas: Area[] }[]
}

interface Result {
  zones: { created: string[]; skipped: { name: string; reason: string }[] }
  missionTypes: string[]
  missions: string[]
  agents: { created: { name: string; phone: string }[]; skipped: { name: string; reason: string }[] }
  agentPassword: string | null
}

interface AgentRow {
  firstName: string
  lastName: string
  phone: string
}

interface CustomArea {
  name: string
  lat: number
  lng: number
  radiusM: number
}

const ICONS: Record<string, LucideIcon> = {
  sales: ShoppingBag,
  collection: HandCoins,
  survey: ClipboardList,
  insurance: Banknote,
  merchandising: Store,
  other: Wrench,
}

const STEPS = ['Votre métier', 'Vos lieux de travail', 'Vos agents', 'C’est parti'] as const

const emptyRow = (): AgentRow => ({ firstName: '', lastName: '', phone: '' })

/** « Koffi Brou 07 01 02 03 04 » → prénom, nom, numéro. */
function parseList(text: string): AgentRow[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const phone = (line.match(/(\+?\d[\d\s.-]{7,}\d)/)?.[1] ?? '').trim()
      const words = line
        .replace(phone, '')
        .replace(/[;,\t]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
      return { firstName: words[0] ?? '', lastName: words.slice(1).join(' '), phone }
    })
    .filter((r) => r.firstName || r.phone)
}

/** Polygone d'un cercle (aperçu du secteur sur la carte, comme le serveur le créera). */
function circleArea(c: CustomArea): Zone['area'] {
  const dLat = c.radiusM / 111_320
  const dLng = c.radiusM / (111_320 * Math.cos((c.lat * Math.PI) / 180))
  const ring = Array.from({ length: 25 }, (_, i) => {
    const a = ((i % 24) / 24) * 2 * Math.PI
    return [c.lng + dLng * Math.cos(a), c.lat + dLat * Math.sin(a)]
  })
  return { type: 'Polygon', coordinates: [ring] } as Zone['area']
}

/**
 * Assistant de démarrage : trois questions (métier, lieux, agents) et la structure est
 * prête — zones, formulaires adaptés, première mission de la semaine, comptes des agents.
 */
export function SetupWizard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { tenant } = useMe()
  const catalog = useQuery({
    queryKey: ['setup', 'catalog'],
    queryFn: async () => (await api.get<Catalog>('/setup/catalog')).data,
    staleTime: Infinity,
  })
  const [step, setStep] = useState(0)
  const [activities, setActivities] = useState<string[]>([])
  const [cityKey, setCityKey] = useState('abidjan')
  const [areaKeys, setAreaKeys] = useState<string[]>([])
  const [custom, setCustom] = useState<CustomArea[]>([])
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null)
  const [pendingName, setPendingName] = useState('')
  const [pendingRadius, setPendingRadius] = useState(1000)
  const [rows, setRows] = useState<AgentRow[]>([emptyRow(), emptyRow(), emptyRow()])
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const data = catalog.data
  const city = data?.cities.find((c) => c.key === cityKey)
  const allAreas = useMemo(() => data?.cities.flatMap((c) => c.areas) ?? [], [data])
  const selected = allAreas.filter((a) => areaKeys.includes(a.key))
  const agents = rows.filter((r) => r.firstName.trim() && r.phone.trim())
  const chosen = data?.activities.filter((a) => activities.includes(a.key)) ?? []
  const shownOnMap: Zone[] = [
    ...selected.map((a) => ({ id: a.key, name: a.name, area: a.area }) as Zone),
    ...custom.map((c, i) => ({ id: `custom-${i}`, name: c.name, area: circleArea(c) }) as Zone),
  ]

  const canNext = step === 0 ? activities.length > 0 : step === 1 ? areaKeys.length + custom.length > 0 : true

  const toggleArea = (key: string) => setAreaKeys((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]))

  const finish = async () => {
    setSaving(true)
    try {
      const res = await api.post<Result>('/setup', {
        activities,
        areaKeys,
        customAreas: custom,
        agents: agents.map((a) => ({ firstName: a.firstName.trim(), lastName: a.lastName.trim() || '-', phone: a.phone.trim() })),
      })
      setResult(res.data)
      await queryClient.invalidateQueries()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const later = async () => {
    await api.post('/setup/skip').catch(() => undefined)
    await queryClient.invalidateQueries({ queryKey: ['setup'] })
    navigate('/start')
  }

  if (result) return <Done result={result} structure={tenant.name} />

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">Démarrage rapide · 2 minutes</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Préparons {tenant.name} ensemble</h1>
        <p className="text-muted-foreground">Répondez à 3 questions : nous créons tout pour vous. Vous pourrez tout modifier ensuite.</p>
      </div>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Étapes">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
              i === step && 'border-primary bg-primary/5 font-medium',
              i < step && 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                i < step ? 'bg-status-active text-white' : i === step ? 'bg-primary text-primary-foreground' : 'bg-muted',
              )}
            >
              {i < step ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      {catalog.isPending ? (
        <div className="flex justify-center p-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Chargement" />
        </div>
      ) : step === 0 ? (
        <section className="flex flex-col gap-4" aria-labelledby="q1">
          <div>
            <h2 id="q1" className="text-xl font-semibold">
              Que font vos agents sur le terrain ?
            </h2>
            <p className="mt-1 text-muted-foreground">Touchez une ou plusieurs activités.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="group" aria-labelledby="q1">
            {data?.activities.map((a) => {
              const Icon = ICONS[a.key] ?? Wrench
              const on = activities.includes(a.key)
              return (
                <button
                  key={a.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setActivities((list) => (on ? list.filter((k) => k !== a.key) : [...list, a.key]))}
                  className={cn(
                    'flex flex-col gap-2 rounded-xl border-2 bg-card p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    on ? 'border-primary bg-primary/5' : 'border-transparent shadow-sm ring-1 ring-border hover:bg-muted/40',
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex size-10 items-center justify-center rounded-lg',
                        on ? 'bg-primary text-primary-foreground' : 'bg-muted',
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="flex-1 text-base font-semibold">{a.label}</span>
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-md border-2',
                        on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30',
                      )}
                    >
                      {on && <Check className="size-4" aria-hidden />}
                    </span>
                  </span>
                  <span className="text-sm">{a.description}</span>
                  <span className="text-xs text-muted-foreground">{a.examples}</span>
                </button>
              )
            })}
          </div>
          {chosen.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <p className="text-sm font-medium">
                {chosen.length > 1
                  ? `Les ${chosen.length} formulaires que vos agents rempliront :`
                  : 'Le formulaire que vos agents rempliront :'}
              </p>
              {chosen.map((c) => (
                <div key={c.key}>
                  {chosen.length > 1 && <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase">{c.label}</p>}
                  <ul className="flex flex-wrap gap-2">
                    {c.fields.map((f) => (
                      <li key={f.label} className="rounded-full bg-muted px-3 py-1 text-sm">
                        {f.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Vous pourrez ajouter ou retirer des questions plus tard.</p>
            </div>
          )}
        </section>
      ) : step === 1 ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" aria-labelledby="q2">
          <div className="flex flex-col gap-4">
            <h2 id="q2" className="text-xl font-semibold">
              Où travaillent vos agents ?
            </h2>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Ville">
              {data?.cities.map((c) => (
                <Button key={c.key} size="sm" variant={c.key === cityKey ? 'default' : 'outline'} onClick={() => setCityKey(c.key)}>
                  {c.name}
                </Button>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Touchez les communes où vos agents travaillent :</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {city?.areas.map((a) => {
                  const on = areaKeys.includes(a.key)
                  return (
                    <button
                      key={a.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleArea(a.key)}
                      className={cn(
                        'flex min-h-12 items-center gap-2 rounded-lg border-2 px-3 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        on ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded border',
                          on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                        )}
                      >
                        {on && <Check className="size-3.5" aria-hidden />}
                      </span>
                      {a.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm font-medium">Un endroit plus précis ? (facultatif)</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Touchez la carte à l’endroit voulu : un marché, un quartier, une zone industrielle…
              </p>
              {pending && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label htmlFor="custom-name">Nom de l’endroit</Label>
                    <Input
                      id="custom-name"
                      value={pendingName}
                      placeholder="Ex. Marché d’Adjamé"
                      onChange={(e) => setPendingName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="custom-radius">Taille</Label>
                    <select
                      id="custom-radius"
                      value={pendingRadius}
                      onChange={(e) => setPendingRadius(Number(e.target.value))}
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                    >
                      <option value={500}>500 m autour</option>
                      <option value={1000}>1 km autour</option>
                      <option value={2000}>2 km autour</option>
                      <option value={5000}>5 km autour</option>
                    </select>
                  </div>
                  <Button
                    disabled={!pendingName.trim()}
                    onClick={() => {
                      setCustom([...custom, { name: pendingName.trim(), lat: pending.lat, lng: pending.lng, radiusM: pendingRadius }])
                      setPending(null)
                      setPendingName('')
                    }}
                  >
                    <Plus aria-hidden /> Ajouter
                  </Button>
                </div>
              )}
              {custom.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {custom.map((c, i) => (
                    <li key={`${c.name}-${i}`} className="flex items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-3 text-sm">
                      <MapPin className="size-3.5" aria-hidden /> {c.name}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Retirer ${c.name}`}
                        onClick={() => setCustom(custom.filter((_, j) => j !== i))}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="flex min-h-80 flex-col gap-2">
            <div className="h-96 overflow-hidden rounded-xl border lg:h-full">
              <BaseMap key={cityKey}>
                {shownOnMap.map((z) => (
                  <Polygon key={z.id} positions={toLatLngs(z.area)} pathOptions={{ color: '#2563eb', weight: 2, fillOpacity: 0.15 }}>
                    <Tooltip>{z.name}</Tooltip>
                  </Polygon>
                ))}
                {pending && (
                  <CircleMarker
                    center={[pending.lat, pending.lng]}
                    radius={8}
                    pathOptions={{ color: '#fff', fillColor: '#dc2626', fillOpacity: 1 }}
                  />
                )}
                <PickPoint onPick={(lat, lng) => setPending({ lat, lng })} />
                {city && <CenterOn lat={city.center.lat} lng={city.center.lng} zoom={city.key === 'abidjan' ? 11 : 13} />}
                {shownOnMap.length > 0 && <FitZones zones={shownOnMap} />}
              </BaseMap>
            </div>
            <p className="text-xs text-muted-foreground">Contours simplifiés : vous pourrez les ajuster sur la carte dans « Zones ».</p>
          </div>
        </section>
      ) : step === 2 ? (
        <section className="flex flex-col gap-4" aria-labelledby="q3">
          <div>
            <h2 id="q3" className="text-xl font-semibold">
              Qui sont vos agents ?
            </h2>
            <p className="mt-1 text-muted-foreground">
              Un nom et un numéro de téléphone suffisent : le numéro sert à se connecter à l’application. Vous pouvez aussi passer cette
              étape.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Prénom</th>
                  <th className="px-3 py-2 font-medium">Nom</th>
                  <th className="px-3 py-2 font-medium">Téléphone</th>
                  <th className="w-10 px-3 py-2">
                    <span className="sr-only">Retirer</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {(['firstName', 'lastName', 'phone'] as const).map((k) => (
                      <td key={k} className="px-2 py-1.5">
                        <Input
                          aria-label={`${k === 'firstName' ? 'Prénom' : k === 'lastName' ? 'Nom' : 'Téléphone'} de l’agent ${i + 1}`}
                          value={r[k]}
                          inputMode={k === 'phone' ? 'tel' : undefined}
                          placeholder={k === 'firstName' ? 'Koffi' : k === 'lastName' ? 'Brou' : '07 01 02 03 04'}
                          onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                        />
                      </td>
                    ))}
                    <td className="px-2">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Retirer la ligne ${i + 1}`}
                        onClick={() => setRows(rows.filter((_, j) => j !== i))}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRows([...rows, emptyRow()])}>
              <Plus aria-hidden /> Ajouter un agent
            </Button>
            <Button variant="outline" onClick={() => setPasting(!pasting)}>
              <ClipboardList aria-hidden /> Coller une liste
            </Button>
          </div>
          {pasting && (
            <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <Label htmlFor="paste">Une ligne par agent : prénom, nom et numéro (copié depuis Excel ou WhatsApp)</Label>
              <Textarea
                id="paste"
                rows={5}
                value={pasted}
                placeholder={'Koffi Brou 07 01 02 03 04\nAwa Koné 05 06 07 08 09'}
                onChange={(e) => setPasted(e.target.value)}
              />
              <div>
                <Button
                  disabled={!pasted.trim()}
                  onClick={() => {
                    const parsed = parseList(pasted)
                    setRows([...rows.filter((r) => r.firstName || r.phone), ...parsed])
                    setPasted('')
                    setPasting(false)
                    toast.success(`${parsed.length} agent${parsed.length > 1 ? 's' : ''} ajouté${parsed.length > 1 ? 's' : ''} à la liste`)
                  }}
                >
                  Ajouter ces agents
                </Button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-4" aria-labelledby="q4">
          <h2 id="q4" className="text-xl font-semibold">
            Tout est prêt à être créé
          </h2>
          <ul className="flex flex-col gap-3">
            <Summary
              icon={ShieldCheck}
              title={`${chosen.length > 1 ? 'Métiers' : 'Métier'} : ${chosen.map((c) => c.label).join(', ')}`}
              detail={
                chosen.length > 1
                  ? 'Pour chaque métier : son formulaire et une mission « objectif de la semaine ».'
                  : 'Le formulaire adapté et une mission « objectif de la semaine ».'
              }
            />
            <Summary
              icon={MapPin}
              title={`${selected.length + custom.length} lieu${selected.length + custom.length > 1 ? 'x' : ''} de travail`}
              detail={[...selected.map((a) => a.name), ...custom.map((c) => c.name)].join(', ')}
            />
            <Summary
              icon={Users}
              title={agents.length ? `${agents.length} agent${agents.length > 1 ? 's' : ''}` : 'Aucun agent pour l’instant'}
              detail={
                agents.length
                  ? agents.map((a) => `${a.firstName} ${a.lastName}`.trim()).join(', ')
                  : 'Vous pourrez les ajouter plus tard dans « Équipe ».'
              }
            />
          </ul>
        </section>
      )}

      <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={later}>
          Je configurerai plus tard
        </Button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" size="lg" onClick={() => setStep(step - 1)}>
              <ArrowLeft aria-hidden /> Retour
            </Button>
          )}
          {step < 3 ? (
            <Button size="lg" disabled={!canNext} onClick={() => setStep(step + 1)}>
              {step === 2 && !agents.length ? 'Passer cette étape' : 'Continuer'} <ArrowRight aria-hidden />
            </Button>
          ) : (
            <Button size="lg" disabled={saving} onClick={finish}>
              {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
              Tout créer
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Summary({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{detail}</span>
      </span>
    </li>
  )
}

function PickPoint({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

function CenterOn({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], zoom)
  }, [lat, lng, zoom, map])
  return null
}

/** Fin : ce qui a été créé, et les identifiants à remettre aux agents. */
function Done({ result, structure }: { result: Result; structure: string }) {
  const navigate = useNavigate()
  const credentials = result.agents.created
  const text = [
    `Bienvenue sur PerformX (${structure}) !`,
    'Installez l’application puis connectez-vous :',
    ...credentials.map((a) => `• ${a.name} : ${formatPhone(a.phone)}`),
    `Mot de passe de départ : ${result.agentPassword ?? ''}`,
  ].join('\n')
  const skipped = [...result.zones.skipped.filter((s) => s.reason !== 'Existe déjà'), ...result.agents.skipped]
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-status-active text-white">
          <Check className="size-7" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">C’est prêt !</h1>
        <p className="text-muted-foreground">Vos agents peuvent démarrer leur journée dès qu’ils ont installé l’application.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        <li className="rounded-xl border bg-card p-4 text-center">
          <p className="text-3xl font-semibold tabular-nums">{result.zones.created.length}</p>
          <p className="text-sm text-muted-foreground">lieux de travail</p>
        </li>
        <li className="rounded-xl border bg-card p-4 text-center">
          <p className="text-3xl font-semibold tabular-nums">{result.missionTypes.length}</p>
          <p className="text-sm text-muted-foreground">
            formulaire{result.missionTypes.length > 1 ? 's' : ''} prêt{result.missionTypes.length > 1 ? 's' : ''}
            {result.missions.length > 0 && ` + ${result.missions.length} mission${result.missions.length > 1 ? 's' : ''} de la semaine`}
          </p>
        </li>
        <li className="rounded-xl border bg-card p-4 text-center">
          <p className="text-3xl font-semibold tabular-nums">{credentials.length}</p>
          <p className="text-sm text-muted-foreground">agents</p>
        </li>
      </ul>

      {credentials.length > 0 && (
        <section className="rounded-xl border bg-card p-4" aria-labelledby="ids">
          <h2 id="ids" className="font-semibold">
            Identifiants à remettre à vos agents
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Chaque agent se connecte avec son numéro et ce mot de passe de départ, puis le change dans son profil.
          </p>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {credentials.map((a) => (
                <tr key={a.phone} className="border-b last:border-0">
                  <td className="py-2 font-medium">{a.name}</td>
                  <td className="py-2 tabular-nums">{formatPhone(a.phone)}</td>
                  <td className="py-2 font-mono">{result.agentPassword}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(text).then(
                  () => toast.success('Copié : collez-le dans WhatsApp ou un SMS'),
                  () => toast.error('Copie impossible'),
                )
              }}
            >
              <Copy aria-hidden /> Copier pour WhatsApp
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer aria-hidden /> Imprimer
            </Button>
          </div>
        </section>
      )}

      {skipped.length > 0 && (
        <section className="rounded-xl border border-status-paused/40 bg-status-paused/5 p-4" aria-labelledby="skipped">
          <h2 id="skipped" className="font-semibold">
            À vérifier
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {skipped.map((s) => (
              <li key={s.name}>
                <span className="font-medium">{s.name}</span> : {s.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button size="lg" onClick={() => navigate('/map')}>
          Voir la carte en temps réel <ArrowRight aria-hidden />
        </Button>
        <Button size="lg" variant="outline" onClick={() => navigate('/start')}>
          Suite du guide « Bien démarrer »
        </Button>
      </div>
    </div>
  )
}
