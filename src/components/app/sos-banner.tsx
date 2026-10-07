import { AlertType, Role } from '@suivi/shared'
import { ArrowRight, LifeBuoy, Phone } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useOpenAlerts } from '@/lib/alerts'
import { useMe } from '@/lib/auth'
import { formatPhone, formatRelative, fullName } from '@/lib/format'

/**
 * Alertes sécurité en cours, sur toutes les pages des responsables : impossible de les
 * manquer tant qu'elles ne sont pas closes.
 */
export function SosBanner() {
  const { user } = useMe()
  const alerts = useOpenAlerts(user.role !== Role.Agent).data ?? []
  const sos = alerts.filter((a) => a.type === AlertType.Sos && !a.resolvedAt)
  if (!sos.length) return null
  return (
    <div role="alert" className="flex flex-col gap-px bg-status-alert">
      {sos.slice(0, 3).map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-status-alert px-4 py-2.5 text-white">
          <LifeBuoy className="size-5 shrink-0 animate-pulse motion-reduce:animate-none" aria-hidden />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">Alerte sécurité : {fullName(a.agent)}</span>
            {typeof a.data.message === 'string' && a.data.message && <span> · « {a.data.message} »</span>}
            <span className="text-white/80"> · {formatRelative(a.startedAt)}</span>
            {a.acknowledgedBy && <span className="text-white/80"> · prise en charge par {fullName(a.acknowledgedBy)}</span>}
          </p>
          <div className="flex gap-2">
            {a.agent.phone && (
              <Button
                size="sm"
                variant="secondary"
                nativeButton={false}
                render={<a href={`tel:${a.agent.phone}`} />}
                aria-label={`Appeler ${fullName(a.agent)}`}
              >
                <Phone aria-hidden /> {formatPhone(a.agent.phone)}
              </Button>
            )}
            <Button size="sm" variant="secondary" nativeButton={false} render={<Link to="/alerts" />}>
              Voir <ArrowRight aria-hidden />
            </Button>
          </div>
        </div>
      ))}
      {sos.length > 3 && (
        <Link to="/alerts" className="bg-status-alert px-4 py-1.5 text-center text-sm font-medium text-white underline">
          {sos.length - 3} autre(s) alerte(s) sécurité
        </Link>
      )}
    </div>
  )
}
