import { Info, Maximize } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** Outils flottants en haut à droite de la carte. */
export function MapTools({ onFit, legend }: { onFit?: () => void; legend?: ReactNode }) {
  return (
    <div className="absolute top-3 right-3 z-[400] flex gap-2">
      {onFit && (
        <Button variant="outline" size="sm" className="h-9 bg-card shadow-md" onClick={onFit}>
          <Maximize aria-hidden /> Recadrer
        </Button>
      )}
      {legend && (
        <Popover>
          <PopoverTrigger render={<Button variant="outline" size="sm" className="h-9 bg-card shadow-md" />}>
            <Info aria-hidden /> Légende
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            {legend}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

export function LegendSection({ title, items }: { title: string; items: { swatch: ReactNode; label: string }[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            <span className="flex w-6 justify-center">{item.swatch}</span>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function MarkerSwatch({ color, symbol }: { color: string; symbol?: string }) {
  return (
    <span
      className="relative flex size-5 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white shadow"
      style={{ background: color }}
    >
      {symbol}
    </span>
  )
}

export function ZoneSwatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return <span className="size-4 rounded-sm" style={{ border: `2px ${dashed ? 'dashed' : 'solid'} ${color}`, background: `${color}22` }} />
}

/** Légende commune aux cartes : remplissage des zones. */
export const ZONE_LEGEND = [
  { swatch: <ZoneSwatch color="#2563eb" />, label: 'Places disponibles' },
  { swatch: <ZoneSwatch color="#b45309" />, label: 'Remplie à 75 % ou plus' },
  { swatch: <ZoneSwatch color="#dc2626" />, label: 'Zone pleine' },
]
