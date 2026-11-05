import { Feature, Role } from '@suivi/shared'
import { Bot, Camera, PieChart, Store } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { PeriodPicker } from '@/components/app/period-picker'
import { StatusPill } from '@/components/app/status'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMe } from '@/lib/auth'
import { formatDate, formatDateTime } from '@/lib/format'
import { usePeriod } from '@/lib/period'
import { formatMoney } from '@/lib/subscription'
import { Card, Chart, Kpi } from '../stats/components'
import { VisitDetailDialog } from '../outlets/VisitDetailDialog'
import { scoreTone, usePhotoAiUsage, useShelfStats } from './photo-ai'

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/**
 * Rayons : ce que l'IA a lu sur les photos de rayon de la période. Score moyen, part de rayon
 * de nos produits, présence et prix par produit, dernier état de chaque point de vente.
 */
export function ShelvesPage() {
  const period = usePeriod()
  const stats = useShelfStats(period.from, period.to)
  const usage = usePhotoAiUsage()
  const { user } = useMe()
  const [visit, setVisit] = useState<string | null>(null)
  const s = stats.data
  const u = usage.data
  const weeks = (s?.weeks ?? []).map((w) => ({ ...w, label: `sem. du ${formatDate(w.week).slice(0, 5)}`, share: w.share ?? 0 }))

  return (
    <Page>
      <PageHeader
        title="Rayons"
        description="Les photos de rayon analysées par l’IA : présence de nos produits, part de rayon face à la concurrence, prix affichés."
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodPicker period={period} />
        {u && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            <span className="font-medium text-foreground">
              {u.used} / {u.quota + u.bonus}
            </span>{' '}
            photos analysées en {MONTHS[Number(u.month.slice(5)) - 1]}
            {u.bonus > 0 && ` (dont ${u.bonus} offertes)`}
            {!u.auto && ' · analyse automatique coupée'}
            {!u.configured && ' · IA momentanément indisponible'}
            {user.role === Role.Admin && (
              <>
                {' · '}
                <Link to="/settings#photo-ai" className="text-primary underline-offset-2 hover:underline">
                  Réglages
                </Link>
              </>
            )}
          </p>
        )}
      </div>
      <QueryState query={stats}>
        {s && s.analyses === 0 ? (
          <EmptyState
            icon={Camera}
            title="Aucune photo de rayon analysée sur la période"
            description="Les photos « rayon » prises par vos agents pendant leurs visites sont analysées automatiquement. Vous pouvez aussi lancer l’analyse d’une photo depuis le détail d’une visite."
          />
        ) : (
          s && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi icon={Camera} label="Photos analysées" value={String(s.analyses)} />
                <Kpi icon={Bot} label="Score moyen du rayon" value={s.avgScore == null ? '—' : String(s.avgScore)} suffix="/ 100" />
                <Kpi
                  icon={PieChart}
                  label="Part de rayon (nos produits)"
                  value={s.share == null ? '—' : `${s.share} %`}
                  hint="Nos faces sur toutes les faces vues"
                />
                <Kpi icon={Store} label="Points de vente photographiés" value={String(s.outletCount)} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Score moyen par semaine">
                  <Chart data={weeks} dataKey="avgScore" name="Score moyen (sur 100)" height={220} />
                </Card>
                <Card title="Part de rayon par semaine (%)">
                  <Chart data={weeks} dataKey="share" name="Part de rayon (%)" height={220} />
                </Card>
              </div>
              <Card title="Nos produits et la concurrence" flush>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="min-w-40">Présence sur les photos</TableHead>
                      <TableHead className="text-right">Faces en moyenne</TableHead>
                      <TableHead className="text-right">Prix lu en moyenne</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.products.map((p) => (
                      <TableRow key={p.productId}>
                        <TableCell>
                          {p.name}
                          {p.format && <span className="text-muted-foreground"> · {p.format}</span>}
                          {!p.own && <span className="ml-1.5 text-xs text-status-paused">concurrent</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={p.presence} className="h-2 w-24" aria-label={`Présence ${p.presence} %`} />
                            <span className="text-sm tabular-nums">{p.presence} %</span>
                            <span className="text-xs text-muted-foreground">sur {p.analyses}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{p.avgFacings ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.avgPrice != null ? formatMoney(p.avgPrice) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
              <Card title="Points de vente : dernière photo de rayon" flush>
                {s.outlets.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">Aucune photo rattachée à un point de vente sur la période.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Point de vente</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead className="text-right">Part de rayon</TableHead>
                        <TableHead>Nos produits absents</TableHead>
                        <TableHead>Photo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.outlets.map((o) => (
                        <TableRow key={o.outletId}>
                          <TableCell className="font-medium">{o.outletName}</TableCell>
                          <TableCell>
                            <StatusPill tone={scoreTone(o.score)} icon={Bot} label={`${o.score} / 100`} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{o.share != null ? `${o.share} %` : '—'}</TableCell>
                          <TableCell className={o.missing.length ? 'text-status-alert' : 'text-muted-foreground'}>
                            {o.missing.length ? o.missing.join(', ') : 'Aucun'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {o.submissionId ? (
                              <button
                                type="button"
                                className="text-left text-primary underline-offset-2 hover:underline"
                                onClick={() => setVisit(o.submissionId)}
                              >
                                {formatDateTime(o.analyzedAt)}
                              </button>
                            ) : (
                              formatDateTime(o.analyzedAt)
                            )}
                            <span className="block text-xs">{o.agent}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </>
          )
        )}
      </QueryState>
      <VisitDetailDialog visitId={visit} onClose={() => setVisit(null)} />
    </Page>
  )
}

export const SHELVES_FEATURE = Feature.PhotoAi
