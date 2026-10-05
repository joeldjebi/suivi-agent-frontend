import { useSearchParams } from 'react-router'

const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86400_000))

/** Périodes prédéfinies : du `from` au `to` inclus. */
export const PRESETS: Record<string, { label: string; range: () => { from: string; to: string } }> = {
  '7d': {
    label: '7 derniers jours',
    range: () => ({ from: daysAgo(6), to: daysAgo(0) }),
  },
  '30d': {
    label: '30 derniers jours',
    range: () => ({ from: daysAgo(29), to: daysAgo(0) }),
  },
  month: {
    label: 'Ce mois-ci',
    range: () => {
      const now = new Date()
      return {
        from: isoDay(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))),
        to: daysAgo(0),
      }
    },
  },
  lastMonth: {
    label: 'Mois dernier',
    range: () => {
      const now = new Date()
      return {
        from: isoDay(new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1))),
        to: isoDay(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0))),
      }
    },
  },
  custom: {
    label: 'Personnalisée',
    range: () => ({ from: daysAgo(29), to: daysAgo(0) }),
  },
}

/** Période dans l'adresse de la page : elle suit l'utilisateur de la liste à la fiche d'un chef. */
export function usePeriod() {
  const [params, setParams] = useSearchParams()
  const preset = params.get('period') ?? '30d'
  const fallback = (PRESETS[preset] ?? PRESETS['30d']).range()
  const from = preset === 'custom' ? (params.get('from') ?? fallback.from) : fallback.from
  const to = preset === 'custom' ? (params.get('to') ?? fallback.to) : fallback.to
  const update = (next: Record<string, string>) =>
    setParams(
      (p) => {
        const merged = new URLSearchParams(p)
        for (const [k, v] of Object.entries(next)) merged.set(k, v)
        if (merged.get('period') !== 'custom') {
          merged.delete('from')
          merged.delete('to')
        }
        return merged
      },
      { replace: true },
    )
  return { preset, from, to, search: params.toString(), update }
}
