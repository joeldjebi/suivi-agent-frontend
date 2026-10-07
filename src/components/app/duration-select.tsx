import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatWorkday } from '@/lib/format'

const STEPS = Array.from({ length: 24 }, (_, i) => (i + 1) * 30)
const INHERIT = 'inherit'

/**
 * Durée de travail par jour, par demi-heure (30 min à 12 h). Avec `inheritLabel`, une valeur
 * vide reprend la durée du niveau au-dessus (groupe ou structure).
 */
export function DurationSelect({
  id,
  value,
  onChange,
  inheritLabel,
}: {
  id?: string
  value: number | null
  onChange: (minutes: number | null) => void
  inheritLabel?: string
}) {
  const current = value === null ? INHERIT : String(value)
  const steps = value !== null && !STEPS.includes(value) ? [...STEPS, value].sort((a, b) => a - b) : STEPS
  return (
    <Select value={current} onValueChange={(v) => onChange(!v || v === INHERIT ? null : Number(v))}>
      <SelectTrigger id={id} className="w-full sm:max-w-sm" aria-label="Durée de travail par jour">
        <SelectValue>{(v: string) => (v === INHERIT ? inheritLabel : formatWorkday(Number(v)))}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {inheritLabel && <SelectItem value={INHERIT}>{inheritLabel}</SelectItem>}
        {steps.map((m) => (
          <SelectItem key={m} value={String(m)}>
            {formatWorkday(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
