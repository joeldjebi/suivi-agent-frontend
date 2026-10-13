import { FieldType, type MissionField, OutletStatus } from '@suivi/shared'
import type { AxiosError } from 'axios'
import { Camera, Loader2, MapPin, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { formatPhone } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { OUTLET_STATUS, STATUSES, useOutletForm, type Outlet } from './outlets'

interface Candidate {
  id: string
  name: string
  status: OutletStatus
  distance: number
}

const NONE = '__none__'

/**
 * Ajout (position choisie sur la carte) ou modification d'un point de vente : informations
 * de base et champs de la fiche. Un commerce semblable tout proche est signalé avant création.
 */
export function OutletFormDialog({
  open,
  onOpenChange,
  outlet,
  position,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Point de vente à modifier ; absent pour un ajout. */
  outlet?: Outlet
  /** Position choisie sur la carte (ajout, ou déplacement par un responsable) */
  position?: { lat: number; lng: number }
  onSaved?: (outlet: Outlet) => void
}) {
  const id = useId()
  const form = useOutletForm()
  const fields = form.data?.fields ?? []
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [managerName, setManagerName] = useState('')
  const [phone, setPhone] = useState('')
  const [landmark, setLandmark] = useState('')
  const [status, setStatus] = useState<OutletStatus>(OutletStatus.New)
  const [comment, setComment] = useState('')
  const [data, setData] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<Candidate[] | null>(null)

  useEffect(() => {
    if (!open) return
    setName(outlet?.name ?? '')
    setCategory(outlet?.category ?? '')
    setManagerName(outlet?.managerName ?? '')
    setPhone(outlet?.phone ? formatPhone(outlet.phone) : '')
    setLandmark(outlet?.landmark ?? '')
    setStatus(OutletStatus.New)
    setComment('')
    setData(outlet?.data ?? {})
    setError(null)
    setDuplicates(null)
  }, [open, outlet])

  const save = useApiMutation(
    async (force: boolean) => {
      const body = {
        name: name.trim(),
        category: category.trim() || null,
        managerName: managerName.trim() || null,
        phone: phone.trim() || null,
        landmark: landmark.trim() || null,
        data: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== '' && v !== undefined)),
        ...(position ? { lat: position.lat, lng: position.lng } : {}),
      }
      if (outlet) return (await api.patch<Outlet>(`/outlets/${outlet.id}`, body)).data
      return (
        await api.post<Outlet>('/outlets', {
          ...body,
          status,
          comment: comment.trim() || undefined,
          force,
        })
      ).data
    },
    {
      success: outlet ? 'Point de vente mis à jour' : 'Point de vente ajouté',
      invalidate: [['outlets']],
      onSuccess: (saved) => {
        onOpenChange(false)
        onSaved?.(saved)
      },
    },
  )

  const submit = (force = false) => {
    if (!name.trim()) return setError('Donnez un nom au point de vente.')
    const missing = fields.find((f) => f.required && f.type !== FieldType.Photo && (data[f.key] === undefined || data[f.key] === ''))
    if (missing) return setError(`Le champ « ${missing.label} » est obligatoire.`)
    setError(null)
    save.mutate(force, {
      onError: (e) => {
        const body = (e as AxiosError<{ code?: string; candidates?: Candidate[] }>).response?.data
        if (body?.code === 'OUTLET_DUPLICATE') setDuplicates(body.candidates ?? [])
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{outlet ? 'Modifier le point de vente' : 'Nouveau point de vente'}</DialogTitle>
          <DialogDescription>
            {position ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {outlet ? 'Nouvelle position choisie sur la carte' : 'Position choisie sur la carte'} ({position.lat.toFixed(5)},{' '}
                {position.lng.toFixed(5)})
              </span>
            ) : (
              'Les agents ajoutent aussi les points de vente depuis l’app, sur place.'
            )}
          </DialogDescription>
        </DialogHeader>

        {duplicates && (
          <div role="alert" className="flex flex-col gap-2 rounded-lg border border-status-paused/30 bg-status-paused/5 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <TriangleAlert className="size-4 text-status-paused" aria-hidden />
              Un point de vente semblable existe déjà tout près
            </p>
            <ul className="flex flex-col gap-1 text-muted-foreground">
              {duplicates.map((c) => (
                <li key={c.id}>
                  <span className="font-medium text-foreground">{c.name}</span> · {OUTLET_STATUS[c.status].label} · à {c.distance} m
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                C’est le même : annuler
              </Button>
              <Button size="sm" disabled={save.isPending} onClick={() => submit(true)}>
                C’est un autre commerce : ajouter
              </Button>
            </div>
          </div>
        )}

        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor={`${id}-name`}>Nom</FieldLabel>
              <Input id={`${id}-name`} autoFocus placeholder="Ex. : Boutique Awa" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-category`}>Type de commerce</FieldLabel>
              <Input
                id={`${id}-category`}
                list={`${id}-categories`}
                placeholder="Boutique, Kiosque…"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <datalist id={`${id}-categories`}>
                {form.data?.categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            {!outlet && (
              <Field>
                <FieldLabel>Statut</FieldLabel>
                <Select value={status} onValueChange={(v) => v && setStatus(v as OutletStatus)}>
                  <SelectTrigger className="w-full" aria-label="Statut">
                    <SelectValue>{(v: OutletStatus) => OUTLET_STATUS[v].label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {OUTLET_STATUS[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor={`${id}-manager`}>Gérant</FieldLabel>
              <Input id={`${id}-manager`} value={managerName} onChange={(e) => setManagerName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-phone`}>Téléphone</FieldLabel>
              <Input
                id={`${id}-phone`}
                type="tel"
                inputMode="tel"
                placeholder="07 07 07 07 07"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor={`${id}-landmark`}>Repère</FieldLabel>
              <Input
                id={`${id}-landmark`}
                placeholder="Ex. : en face de la pharmacie du marché"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
              />
            </Field>
            {!outlet && (
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor={`${id}-comment`}>Commentaire (facultatif)</FieldLabel>
                <Input id={`${id}-comment`} value={comment} onChange={(e) => setComment(e.target.value)} />
              </Field>
            )}
          </div>

          {fields.length > 0 && (
            <div className="flex flex-col gap-4 border-t pt-4">
              <p className="text-sm font-medium">Fiche</p>
              {fields.map((f) => (
                <CustomField
                  key={f.key}
                  id={`${id}-${f.key}`}
                  field={f}
                  value={data[f.key]}
                  onChange={(v) => setData((d) => ({ ...d, [f.key]: v }))}
                />
              ))}
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => submit(false)} disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Saisie d'un champ de la fiche selon son type ; les photos se prennent depuis l'app. */
function CustomField({
  id,
  field,
  value,
  onChange,
}: {
  id: string
  field: MissionField
  value: unknown
  onChange: (value: unknown) => void
}) {
  const label = `${field.label}${field.required ? ' *' : ''}`
  switch (field.type) {
    case FieldType.Boolean:
      return (
        <label className="flex items-center justify-between gap-3 text-sm">
          {label}
          <Switch checked={value === true} onCheckedChange={(c) => onChange(c)} />
        </label>
      )
    case FieldType.Select:
      return (
        <Field>
          <FieldLabel>{label}</FieldLabel>
          <Select value={(value as string) ?? NONE} onValueChange={(v) => onChange(v === NONE ? undefined : v)}>
            <SelectTrigger className="w-full" aria-label={field.label}>
              <SelectValue>{(v: string) => (v === NONE ? '—' : v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {field.options?.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )
    case FieldType.Photo:
      return (
        <Field>
          <FieldLabel>{label}</FieldLabel>
          <FieldDescription className="flex items-center gap-1.5">
            <Camera className="size-3.5" aria-hidden /> Photo prise sur place depuis l’app mobile.
          </FieldDescription>
        </Field>
      )
    case FieldType.Number:
      return (
        <Field>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            value={typeof value === 'number' ? value : ''}
            onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </Field>
      )
    case FieldType.Date:
      return (
        <Field>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input id={id} type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />
        </Field>
      )
    default:
      return (
        <Field>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          {field.label.length > 30 ? (
            <Textarea id={id} rows={2} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
          ) : (
            <Input id={id} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
          )}
        </Field>
      )
  }
}
