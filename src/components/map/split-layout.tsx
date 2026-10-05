import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePersistentState } from '@/lib/use-persistent-state'
import { cn } from '@/lib/utils'

/**
 * Page « liste + carte ». Le panneau se replie pour afficher la carte en plein écran ;
 * le choix est mémorisé. Replié, un bouton flottant le rouvre et rappelle l'essentiel.
 */
export function MapSplitLayout({
  storageKey,
  title,
  subtitle,
  actions,
  panel,
  collapsedSummary,
  overlay,
  map,
}: {
  storageKey: string
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  panel: ReactNode
  /** Rappel affiché sur le bouton de réouverture, ex. « 3 agents · 1 alerte » */
  collapsedSummary?: ReactNode
  /** Éléments flottants sur la carte (outils, fiche…) */
  overlay?: ReactNode
  map: ReactNode
}) {
  const [collapsed, setCollapsed] = usePersistentState(`layout.${storageKey}.collapsed`, false)
  const panelId = `${storageKey}-panel`

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <section
        id={panelId}
        aria-label={title}
        hidden={collapsed}
        className="flex max-h-[45%] min-h-0 flex-col border-b bg-card lg:max-h-none lg:w-96 lg:shrink-0 lg:border-r lg:border-b-0"
      >
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {actions}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Replier le panneau"
                  aria-expanded={!collapsed}
                  aria-controls={panelId}
                  onClick={() => setCollapsed(true)}
                />
              }
            >
              <PanelLeftClose aria-hidden />
            </TooltipTrigger>
            <TooltipContent>Carte en plein écran</TooltipContent>
          </Tooltip>
        </div>
        {panel}
      </section>

      <section aria-label="Carte" className="relative min-h-0 flex-1">
        {map}
        {collapsed && (
          <div className="absolute top-3 left-14 z-[400] flex items-center gap-2">
            <Button
              variant="outline"
              className="h-9 bg-card shadow-md"
              aria-expanded={false}
              aria-controls={panelId}
              onClick={() => setCollapsed(false)}
            >
              <PanelLeftOpen aria-hidden />
              <span className="font-medium">{title}</span>
              {collapsedSummary && <span className={cn('border-l pl-2 text-xs font-normal text-muted-foreground')}>{collapsedSummary}</span>}
            </Button>
          </div>
        )}
        {overlay}
      </section>
    </div>
  )
}
