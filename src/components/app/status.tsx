import { DayStatus, MissionStatus, ZoneRequestStatus } from '@suivi/shared'
import {
  CheckCircle2,
  Circle,
  CircleDot,
  CircleSlash,
  Clock,
  PauseCircle,
  Target,
  WifiOff,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { dayStatusLabel, missionStatusLabel, requestStatusLabel } from '@/lib/labels'

type Tone = 'active' | 'paused' | 'alert' | 'ended' | 'info'

const toneClass: Record<Tone, string> = {
  active: 'bg-status-active/10 text-status-active border-status-active/20',
  paused: 'bg-status-paused/10 text-status-paused border-status-paused/20',
  alert: 'bg-status-alert/10 text-status-alert border-status-alert/20',
  ended: 'bg-muted text-status-ended border-border',
  info: 'bg-primary/10 text-primary border-primary/20',
}

/** Pastille de statut : toujours une icône et un libellé, jamais la couleur seule. */
export function StatusPill({ tone, icon: Icon, label, className }: { tone: Tone; icon: LucideIcon; label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap',
        toneClass[tone],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  )
}

export function DayStatusPill({ status, signalLost }: { status: DayStatus; signalLost?: boolean }) {
  if (signalLost) return <StatusPill tone="alert" icon={WifiOff} label="Signal perdu" />
  const config: Record<DayStatus, [Tone, LucideIcon]> = {
    [DayStatus.Active]: ['active', CircleDot],
    [DayStatus.Paused]: ['paused', PauseCircle],
    [DayStatus.Ended]: ['ended', CheckCircle2],
  }
  const [tone, icon] = config[status]
  return <StatusPill tone={tone} icon={icon} label={dayStatusLabel[status]} />
}

export function RequestStatusPill({ status }: { status: ZoneRequestStatus }) {
  const config: Record<ZoneRequestStatus, [Tone, LucideIcon]> = {
    [ZoneRequestStatus.Pending]: ['paused', Clock],
    [ZoneRequestStatus.Approved]: ['active', CheckCircle2],
    [ZoneRequestStatus.Rejected]: ['alert', XCircle],
    [ZoneRequestStatus.Expired]: ['ended', Clock],
    [ZoneRequestStatus.Cancelled]: ['ended', CircleSlash],
    [ZoneRequestStatus.Released]: ['ended', Circle],
  }
  const [tone, icon] = config[status]
  return <StatusPill tone={tone} icon={icon} label={requestStatusLabel[status]} />
}

export function MissionStatusPill({ status }: { status: MissionStatus }) {
  const config: Record<MissionStatus, [Tone, LucideIcon]> = {
    [MissionStatus.Todo]: ['ended', Circle],
    [MissionStatus.InProgress]: ['info', Target],
    [MissionStatus.Achieved]: ['active', CheckCircle2],
    [MissionStatus.Failed]: ['alert', XCircle],
  }
  const [tone, icon] = config[status]
  return <StatusPill tone={tone} icon={icon} label={missionStatusLabel[status]} />
}
