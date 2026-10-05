import { AlertType, type AgentAlertInfo } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import { BatteryWarning, Footprints, MapPinOff, ShieldAlert, Sunrise, WifiOff, type LucideIcon } from 'lucide-react'
import { api } from './api'
import { formatTime } from './format'

/** Libellé, icône et explication de chaque alerte. */
export const ALERT_META: Record<AlertType, { label: string; icon: LucideIcon; hint: string }> = {
  [AlertType.SignalLost]: { label: 'Signal perdu', icon: WifiOff, hint: 'GPS coupé, application fermée ou réseau absent.' },
  [AlertType.Immobile]: { label: 'Immobile', icon: Footprints, hint: 'Aucun déplacement notable depuis un moment.' },
  [AlertType.LowBattery]: { label: 'Batterie faible', icon: BatteryWarning, hint: 'Le suivi risque de s’arrêter.' },
  [AlertType.Mocked]: { label: 'Position simulée', icon: ShieldAlert, hint: 'Une application de fausse position GPS est utilisée.' },
  [AlertType.OutOfZone]: { label: 'Hors zone', icon: MapPinOff, hint: 'Hors de sa zone au-delà du délai d’alerte.' },
  [AlertType.LateStart]: { label: 'Journée pas démarrée', icon: Sunrise, hint: 'Après l’heure de début attendue.' },
}

function meters(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.max(10, Math.round(m / 10) * 10)} m`
}

/** Détail lisible d'une alerte, selon son type. */
export function alertDetail(a: AgentAlertInfo, timeZone?: string): string {
  const d = a.data
  switch (a.type) {
    case AlertType.SignalLost:
      return d.lastPositionAt ? `Dernière position à ${formatTime(String(d.lastPositionAt), timeZone)}` : 'Aucune position reçue'
    case AlertType.Immobile:
      return `Dans un rayon de ${String(d.radiusM)} m depuis ${formatTime(String(d.since), timeZone)}`
    case AlertType.LowBattery:
      return `Batterie à ${String(d.percent)} %`
    case AlertType.Mocked:
      return ALERT_META[a.type].hint
    case AlertType.OutOfZone:
      return `Hors de ${String(d.zoneName ?? 'sa zone')}, jusqu’à ${meters(Number(d.maxDistanceM))}`
    case AlertType.LateStart:
      return `Début attendu à ${String(d.expectedAt)}`
  }
}

/** Alertes en cours du périmètre (compteur du menu, page Alertes). */
export function useOpenAlerts(enabled = true) {
  return useQuery({
    queryKey: ['alerts', 'open'],
    enabled,
    queryFn: async () => (await api.get<AgentAlertInfo[]>('/alerts')).data,
    refetchInterval: 60_000,
  })
}
