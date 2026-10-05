import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PRESETS, type usePeriod } from '@/lib/period'

/** Période prédéfinie ou dates précises ; l'état vit dans l'adresse de la page (voir usePeriod). */
export function PeriodPicker({ period }: { period: ReturnType<typeof usePeriod> }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>Période</Label>
        <Select
          value={period.preset}
          onValueChange={(v) =>
            period.update({
              period: v ?? '30d',
              from: period.from,
              to: period.to,
            })
          }
        >
          <SelectTrigger className="w-48" aria-label="Période">
            <SelectValue>{(v: string) => PRESETS[v]?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PRESETS).map(([key, p]) => (
              <SelectItem key={key} value={key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {period.preset === 'custom' && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period-from">Du</Label>
            <Input
              id="period-from"
              type="date"
              value={period.from}
              max={period.to}
              onChange={(e) => e.target.value && period.update({ from: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period-to">Au</Label>
            <Input
              id="period-to"
              type="date"
              value={period.to}
              min={period.from}
              onChange={(e) => e.target.value && period.update({ to: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  )
}
