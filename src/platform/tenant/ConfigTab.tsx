import { useQuery } from '@tanstack/react-query'
import { Check, CircleSlash, Lock, Minus } from 'lucide-react'
import type { ReactNode } from 'react'
import { QueryState } from '@/components/app/page'
import { Card } from '@/features/stats/components'
import { formatDateTime, formatPhone } from '@/lib/format'
import { approvalModeLabel } from '@/lib/labels'
import { featureLabel } from '@/lib/subscription'
import type { ApprovalMode } from '@suivi/shared'
import { platformApi } from '../api'
import { Row } from '../components'
import type { TenantConfig } from '../types'

const yes = (v: boolean) => (v ? 'Oui' : 'Non')
const periodLabel: Record<string, string> = { weekly: 'Hebdomadaire', biweekly: 'Quinzaine', monthly: 'Mensuelle' }

/** Configuration de la structure : avantages utilisés, réglages (enregistrés et en vigueur), apparence. */
export function ConfigTab({ tenantId }: { tenantId: string }) {
  const query = useQuery({
    queryKey: ['platform', 'tenant', tenantId, 'config'],
    queryFn: async () => (await platformApi.get<TenantConfig>(`/tenants/${tenantId}/config`)).data,
  })
  const c = query.data
  return (
    <QueryState query={query} rows={6}>
      {c && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card title="Avantages de la formule" flush>
            <ul className="divide-y">
              {c.features.map((f) => (
                <li key={f.feature} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  {f.included ? (
                    <Check className="size-4 shrink-0 text-status-active" aria-label="Inclus" />
                  ) : (
                    <CircleSlash className="size-4 shrink-0 text-muted-foreground" aria-label="Non inclus" />
                  )}
                  <span className={f.included ? 'flex-1' : 'flex-1 text-muted-foreground'}>{featureLabel[f.feature]}</span>
                  <span className="text-xs text-muted-foreground">
                    {f.usage ? (
                      <span className={f.included ? 'font-medium text-foreground' : 'text-status-paused'}>
                        {f.usage}
                        {!f.included && ' (désactivé par la formule)'}
                      </span>
                    ) : f.included ? (
                      'Pas encore utilisé'
                    ) : (
                      <Minus className="size-3.5" aria-hidden />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Réglages">
            <div className="divide-y">
              <Setting
                label="Groupes et chefs d’équipe"
                saved={yes(c.settings.useGroups)}
                effective={c.effective ? yes(c.effective.useGroups) : undefined}
              />
              <Setting
                label="Validation des zones"
                saved={approvalModeLabel[c.settings.approvalMode as ApprovalMode] ?? c.settings.approvalMode}
                effective={
                  c.effective ? (approvalModeLabel[c.effective.approvalMode as ApprovalMode] ?? c.effective.approvalMode) : undefined
                }
              />
              <Row label="Zone obligatoire pour démarrer">{yes(c.settings.zoneRequired)}</Row>
              <Row label="Changement de zone avant le démarrage">{yes(c.settings.allowZoneChangeBeforeStart)}</Row>
              <Row label="Démarrer avant la validation">{yes(c.settings.startWhilePending)}</Row>
              <Row label="Expiration d’une demande">{c.settings.requestExpirationMinutes} min</Row>
              <Row label="Remise à zéro quotidienne">
                {c.settings.dailyResetTime} · {c.settings.timezone}
              </Row>
              <Row label="Fin automatique des journées oubliées">{yes(c.settings.autoEndDayAtReset)}</Row>
              <Row label="Suivi pendant la pause">{yes(c.settings.trackDuringPause)}</Row>
              <Row label="Délai « signal perdu »">{c.settings.signalLostMinutes} min</Row>
              <Row label="Marge autour des zones">{c.settings.zoneExitToleranceMeters} m</Row>
              <Row label="Alerte de sortie de zone">après {c.settings.zoneExitAlertMinutes} min</Row>
              <Row label="Conservation des positions">{c.settings.positionRetentionDays} jours</Row>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Modifiés le {formatDateTime(c.settings.updatedAt)}</p>
          </Card>

          <Card title="Application mobile">
            {c.branding ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <span
                    className="flex size-10 items-center justify-center rounded-xl text-sm font-semibold text-white"
                    style={{ background: c.branding.primaryColor }}
                    aria-hidden
                  >
                    {(c.branding.displayName ?? '?').slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.branding.displayName ?? 'Nom de la structure'}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.branding.welcomeMessage ?? 'Pas de message d’accueil'}</p>
                  </div>
                </div>
                <div className="divide-y">
                  <Row label="Couleur">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-3 rounded-full border" style={{ background: c.branding.primaryColor }} aria-hidden />
                      {c.branding.primaryColor}
                    </span>
                  </Row>
                  <Row label="Logo">{c.branding.hasLogo ? 'Oui' : 'Non'}</Row>
                  <Row label="Numéro du responsable">{formatPhone(c.branding.supportPhone)}</Row>
                </div>
                {!c.features.find((f) => f.feature === 'branding')?.included && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="size-3.5" aria-hidden /> Non inclus dans la formule : l’app affiche l’apparence neutre.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Apparence par défaut.</p>
            )}
          </Card>

          <Card title="Rémunération">
            <div className="divide-y">
              <Row label="Période de paie">{c.payroll.period ? (periodLabel[c.payroll.period] ?? c.payroll.period) : 'Non réglée'}</Row>
              <Row label="Grilles actives">{c.payroll.grids}</Row>
              <Row label="Paies calculées">{c.payroll.runs}</Row>
            </div>
          </Card>
        </div>
      )}
    </QueryState>
  )
}

/** Réglage enregistré, et sa valeur en vigueur quand la formule la limite. */
function Setting({ label, saved, effective }: { label: string; saved: string; effective?: string }): ReactNode {
  const limited = effective !== undefined && effective !== saved
  return (
    <Row label={label}>
      {limited ? (
        <span className="flex flex-col items-end">
          <span>{effective}</span>
          <span className="flex items-center gap-1 text-xs font-normal text-status-paused">
            <Lock className="size-3" aria-hidden /> Réglé sur « {saved} », limité par la formule
          </span>
        </span>
      ) : (
        saved
      )}
    </Row>
  )
}
