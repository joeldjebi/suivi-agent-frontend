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
/** Échappe une valeur insérée dans un attribut HTML (l'URL d'image vient d'un blob local). */
function attr(value: string): string {
  return value.replace(/"/g, '&quot;')
}

export function agentIcon(opts: {
  initials: string
  status: DayStatus
  alert: boolean
  selected: boolean
  /** Photo de profil (blob en mémoire) ; si absente, on affiche les initiales. */
  photoUrl?: string | null
}): L.DivIcon {
  const color = opts.alert ? COLORS.alert : opts.status === DayStatus.Paused ? COLORS.paused : COLORS.active
  const badge = opts.alert ? '!' : opts.status === DayStatus.Paused ? '‖' : ''
  const ring = opts.selected ? `box-shadow:0 0 0 3px #fff,0 0 0 5px ${color};` : 'box-shadow:0 1px 3px rgb(0 0 0 / .35);'
  // Avec photo : l'anneau de couleur du statut reste la bordure ; sinon, pastille aux initiales.
  const inside = opts.photoUrl
    ? `<img src="${attr(opts.photoUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:9999px" />`
    : opts.initials
  const background = opts.photoUrl ? '#e5e7eb' : color
  const border = opts.photoUrl ? `3px solid ${color}` : '2px solid #fff'
  return L.divIcon({
    className: 'agent-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `<div style="position:relative;width:32px;height:32px">
      <div style="width:32px;height:32px;border-radius:9999px;background:${background};color:#fff;border:${border};${ring}display:flex;align-items:center;justify-content:center;overflow:hidden;box-sizing:border-box;font:600 11px/1 'Plus Jakarta Sans Variable',sans-serif">
        ${inside}
      </div>
      ${badge ? `<span style="position:absolute;top:-6px;right:-6px;width:16px;height:16px;border-radius:9999px;background:#fff;color:${color};border:1.5px solid ${color};font:700 10px/13px sans-serif;text-align:center">${badge}</span>` : ''}
    </div>`,
  })
}
