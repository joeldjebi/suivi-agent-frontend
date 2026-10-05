import type { LandingAction, LandingCta, LandingVisual } from '@suivi/shared'
import { ArrowDown, ArrowUp, ChevronDown, ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { platformApi } from '../api'

/** Champs de l'éditeur du site : compacts, libellé au-dessus, compteur de caractères. */

let counter = 0
const useId = (prefix: string) => {
  const [id] = useState(() => `${prefix}-${++counter}`)
  return id
}

export function TextField({
  label,
  value,
  onChange,
  max,
  placeholder,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  max: number
  placeholder?: string
  hint?: string
}) {
  const id = useId('f')
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        <span className={cn('text-[10px] tabular-nums', value.length > max ? 'text-destructive' : 'text-muted-foreground')}>
          {value.length}/{max}
        </span>
      </div>
      <Input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function AreaField({
  label,
  value,
  onChange,
  max,
  rows = 3,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  max: number
  rows?: number
  hint?: string
}) {
  const id = useId('a')
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        <span className={cn('text-[10px] tabular-nums', value.length > max ? 'text-destructive' : 'text-muted-foreground')}>
          {value.length}/{max}
        </span>
      </div>
      <Textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-0 text-sm" />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs font-medium">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Record<T, string>
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={(v) => v && onChange(v as T)}>
        <SelectTrigger className="h-8 w-full text-sm" aria-label={label}>
          <SelectValue>{(v: T) => options[v]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(options) as T[]).map((k) => (
            <SelectItem key={k} value={k}>
              {options[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

const ACTIONS: Record<LandingAction, string> = {
  signup: 'Inscription (essai gratuit)',
  demo: 'Demande de démo',
  login: 'Connexion',
  link: 'Lien',
}

export function CtaField({ label, value, onChange }: { label: string; value: LandingCta; onChange: (v: LandingCta) => void }) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border p-2.5">
      <legend className="px-1 text-xs font-medium">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <TextField label="Texte" value={value.label} max={40} onChange={(v) => onChange({ ...value, label: v })} />
        <SelectField label="Action" value={value.action} options={ACTIONS} onChange={(action) => onChange({ ...value, action })} />
      </div>
      {value.action === 'link' && (
        <TextField
          label="Adresse"
          value={value.href ?? ''}
          max={300}
          placeholder="https://… ou #tarifs"
          onChange={(href) => onChange({ ...value, href })}
        />
      )}
    </fieldset>
  )
}

const VISUALS: Record<LandingVisual, string> = {
  map: 'Carte en direct',
  phone: 'Téléphone (journée)',
  missions: 'Missions',
  payroll: 'Fiche de paie',
  dashboard: 'Tableau de bord',
  image: 'Image personnalisée',
}

/** Illustration : animée par le site, ou image envoyée (PNG, JPEG, WebP, 2 Mo). */
export function VisualField({
  visual,
  imageId,
  onChange,
}: {
  visual: LandingVisual
  imageId?: string | null
  onChange: (visual: LandingVisual, imageId: string | null) => void
}) {
  const [uploading, setUploading] = useState(false)
  const upload = async (file: File) => {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await platformApi.post<{ id: string }>('/landing/assets', form)
      onChange('image', data.id)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setUploading(false)
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <SelectField
        label="Illustration"
        value={visual}
        options={VISUALS}
        onChange={(v) => onChange(v, v === 'image' ? (imageId ?? null) : null)}
      />
      {visual === 'image' && (
        <div className="flex items-center gap-2">
          {imageId ? (
            <img src={`/api/public/landing/assets/${imageId}`} alt="" className="h-14 w-20 rounded-md border object-cover" />
          ) : (
            <span className="text-xs text-destructive">Aucune image : envoyez-en une.</span>
          )}
          <label className="ml-auto">
            <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted">
              {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <ImagePlus className="size-3.5" aria-hidden />}
              {imageId ? 'Remplacer' : 'Envoyer une image'}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void upload(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      )}
    </div>
  )
}

/** Liste éditable : ajout, suppression, réordonnancement. */
export function ListField<T>({
  label,
  items,
  onChange,
  max,
  create,
  render,
}: {
  label: string
  items: T[]
  onChange: (items: T[]) => void
  max: number
  create: () => T
  render: (item: T, update: (item: T) => void) => ReactNode
}) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...items]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium">
        {label}{' '}
        <span className="font-normal text-muted-foreground">
          ({items.length}/{max})
        </span>
      </p>
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-2.5">
          <div className="flex items-center justify-end gap-0.5">
            <span className="mr-auto text-[11px] font-medium text-muted-foreground">#{i + 1}</span>
            <Button variant="ghost" size="icon-xs" aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp aria-hidden />
            </Button>
            <Button variant="ghost" size="icon-xs" aria-label="Descendre" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
              <ArrowDown aria-hidden />
            </Button>
            <Button variant="ghost" size="icon-xs" aria-label="Supprimer" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <Trash2 aria-hidden />
            </Button>
          </div>
          {render(item, (next) => onChange(items.map((x, j) => (j === i ? next : x))))}
        </div>
      ))}
      {items.length < max && (
        <Button variant="outline" size="sm" onClick={() => onChange([...items, create()])}>
          <Plus aria-hidden /> Ajouter
        </Button>
      )}
    </div>
  )
}

/** Bloc repliable de l'éditeur. */
export function Block({
  title,
  subtitle,
  open,
  onToggle,
  actions,
  children,
  muted,
}: {
  title: string
  subtitle?: string
  open: boolean
  onToggle: () => void
  actions?: ReactNode
  children: ReactNode
  muted?: boolean
}) {
  return (
    <div className={cn('rounded-lg border bg-card', muted && 'opacity-60')}>
      <div className="flex items-center gap-1 pr-1.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left"
          aria-expanded={open}
          onClick={onToggle}
        >
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')} aria-hidden />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{title}</span>
            {subtitle && <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>}
          </span>
        </button>
        {actions}
      </div>
      {open && <div className="flex flex-col gap-3 border-t p-3">{children}</div>}
    </div>
  )
}
