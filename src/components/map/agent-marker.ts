import { DayStatus } from '@suivi/shared'
import L from 'leaflet'

const COLORS = {
  active: '#15803d',
  paused: '#b45309',
  alert: '#dc2626',
}

/**
 * Marqueur d'agent : pastille aux initiales, couleur du statut et symbole
 * (‖ pause, ! alerte) pour ne pas reposer sur la couleur seule.
 */
export function agentIcon(opts: {
  initials: string
  status: DayStatus
  alert: boolean
  selected: boolean
}): L.DivIcon {
  const color = opts.alert ? COLORS.alert : opts.status === DayStatus.Paused ? COLORS.paused : COLORS.active
  const badge = opts.alert ? '!' : opts.status === DayStatus.Paused ? '‖' : ''
  const ring = opts.selected ? `box-shadow:0 0 0 3px #fff,0 0 0 5px ${color};` : 'box-shadow:0 1px 3px rgb(0 0 0 / .35);'
  return L.divIcon({
    className: 'agent-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `<div style="position:relative;width:32px;height:32px;border-radius:9999px;background:${color};color:#fff;border:2px solid #fff;${ring}display:flex;align-items:center;justify-content:center;font:600 11px/1 'Plus Jakarta Sans Variable',sans-serif">
      ${opts.initials}
      ${badge ? `<span style="position:absolute;top:-6px;right:-6px;width:16px;height:16px;border-radius:9999px;background:#fff;color:${color};border:1.5px solid ${color};font:700 10px/13px sans-serif;text-align:center">${badge}</span>` : ''}
    </div>`,
  })
}
