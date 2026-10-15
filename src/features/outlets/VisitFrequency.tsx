import { CalendarClock, Clock } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { OVERDUE_COLOR } from './outlet-icons'
import { visitLabel, type Outlet } from './outlets'

const DEFAULT = 'default'
const CHOICES = [7, 14, 30, 60, 90]

/**
 * Suivi des visites d'un point de vente : dernière visite, prochaine visite due (et retard),
 * fréquence propre ou celle de la structure.
 */
export function VisitFrequency({ outlet }: { outlet: Outlet }) {
  const { settings } = useMe()
  const save = useApiMutation((days: number | null) => api.patch(`/outlets/${outlet.id}`, { visitFrequencyDays: days }), {
    success: 'Fréquence de visite enregistrée',
    invalidate: [['outlets']],
  })
  const lateDays =
    outlet.overdue && outlet.dueAt ? Math.max(1, Math.round((Date.now() - new Date(outlet.dueAt).getTime()) / 86_400_000)) : 0
  const choices = [...new Set([...CHOICES, ...(outlet.visitFrequencyDays ? [outlet.visitFrequencyDays] : [])])].sort((a, b) => a - b)

  return (
    <section
      className={cn('flex flex-col gap-2 rounded-lg border p-3 text-sm', outlet.overdue && 'border-[#ea580c]/40 bg-[#ea580c]/5')}
      aria-label="Visites"
    >
      <div className="flex items-start gap-2">
        {outlet.overdue ? (
          <Clock className="mt-0.5 size-4 shrink-0" style={{ color: OVERDUE_COLOR }} aria-hidden />
        ) : (
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <div className="flex flex-col">
          <span className="font-medium">{visitLabel(outlet)}</span>
          {outlet.frequencyDays === 0 ? (
            <span className="text-xs text-muted-foreground">Fréquence de visite non suivie.</span>
          ) : outlet.overdue ? (
            <span className="text-xs font-medium" style={{ color: OVERDUE_COLOR }}>
              En retard de {lateDays} jour{lateDays > 1 ? 's' : ''} : visite attendue le {formatDate(outlet.dueAt)}
            </span>
          ) : (
            outlet.dueAt && <span className="text-xs text-muted-foreground">Prochaine visite avant le {formatDate(outlet.dueAt)}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Visiter</span>
        <Select
          value={outlet.visitFrequencyDays === null ? DEFAULT : String(outlet.visitFrequencyDays)}
          onValueChange={(v) => v && save.mutate(v === DEFAULT ? null : Number(v))}
        >
          <SelectTrigger size="sm" className="w-48" aria-label="Fréquence de visite">
            <SelectValue>
              {(v: string) =>
                v === DEFAULT
                  ? settings.outletVisitFrequencyDays
                    ? `Par défaut (${settings.outletVisitFrequencyDays} j)`
                    : 'Par défaut (non suivi)'
                  : `Tous les ${v} jours`
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT}>
              {settings.outletVisitFrequencyDays
                ? `Comme la structure (tous les ${settings.outletVisitFrequencyDays} j)`
                : 'Comme la structure (non suivi)'}
            </SelectItem>
            {choices.map((d) => (
              <SelectItem key={d} value={String(d)}>
                Tous les {d} jours
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </section>
  )
}
