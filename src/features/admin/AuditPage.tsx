import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { FileClock } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDateTime, fullName } from '@/lib/format'
import { useAllUsers } from '@/lib/queries'
import type { AuditLog, Page as PageOf } from '@/lib/types'

const ACTIONS: Record<string, string> = {
  'auth.register': 'Création de l’espace',
  'auth.login': 'Connexion',
  'auth.login_failed': 'Échec de connexion',
}

/** Sujet d'une action, d'après la partie de l'application concernée. */
const SUBJECTS: Record<string, string> = {
  Alerts: 'Alertes',
  Auth: 'Compte',
  Billing: 'Facturation',
  Branding: 'Personnalisation',
  Broadcasts: 'Notifications aux équipes',
  Days: 'Journées',
  Devices: 'Téléphones',
  Exports: 'Exports',
  Groups: 'Groupes',
  Me: 'Profil',
  MissionTypes: 'Formulaires',
  Missions: 'Missions',
  Notifications: 'Notifications',
  Onboarding: 'Démarrage',
  Orders: 'Commandes',
  Outlets: 'Points de vente',
  Payroll: 'Rémunération',
  Photos: 'Photos',
  Positions: 'Positions',
  Products: 'Produits',
  Reports: 'Rapports',
  Safety: 'Sécurité',
  Settings: 'Paramètres',
  Setup: 'Démarrage',
  Subscriptions: 'Abonnement',
  Suggestions: 'Produits signalés',
  Support: 'Assistance',
  TeamLeads: 'Chefs d’équipe',
  Users: 'Utilisateurs',
  ZoneRequests: 'Demandes de zone',
  Zones: 'Zones',
}

/** Verbe d'une action, d'après son nom (create, update, remove…). */
function verb(method: string) {
  const m = method.toLowerCase()
  if (/^(create|add|register|send|upload|import|start|submit)/.test(m)) return 'Ajout'
  if (/^(remove|delete|archive|deactivate|cancel)/.test(m)) return 'Suppression'
  if (/^(approve|accept|decide|validate)/.test(m)) return 'Décision'
  if (/^(reject|refuse)/.test(m)) return 'Refus'
  return 'Modification'
}

/** « ZonesController.create » → « Zones · Ajout » */
function describe(action: string) {
  if (ACTIONS[action]) return ACTIONS[action]
  const [controller = '', method = ''] = action.split('.')
  const subject = SUBJECTS[controller.replace(/Controller$/, '')] ?? 'Espace'
  return `${subject} · ${verb(method)}`
}

/** Réussi ou refusé, sans code technique. */
function outcome(log: AuditLog) {
  if (log.action === 'auth.login_failed') return { label: 'Refusé', failed: true }
  const failed = !!log.statusCode && log.statusCode >= 400
  return { label: failed ? 'Refusé' : 'Réussi', failed }
}

export function AuditPage() {
  const { settings } = useMe()
  const users = useAllUsers()
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['audit', page],
    queryFn: async () => (await api.get<PageOf<AuditLog>>('/audit-logs', { params: { page, limit: 50 } })).data,
    placeholderData: keepPreviousData,
  })
  const items = query.data?.items ?? []
  const pages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.limit)) : 1

  return (
    <Page>
      <PageHeader title="Journal d'accès" description="Connexions et modifications effectuées dans votre espace." />
      <QueryState query={query}>
        {items.length === 0 ? (
          <EmptyState icon={FileClock} title="Journal vide" />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Résultat</TableHead>
                  <TableHead>Adresse IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="tabular-nums">{formatDateTime(log.createdAt, settings.timezone)}</TableCell>
                    <TableCell>{log.userId ? fullName(users.data?.find((u) => u.id === log.userId)) : '—'}</TableCell>
                    <TableCell>{describe(log.action)}</TableCell>
                    <TableCell className={outcome(log).failed ? 'text-destructive' : undefined}>{outcome(log).label}</TableCell>
                    <TableCell className="font-mono text-xs">{log.ip ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Précédent
            </Button>
            <span className="tabular-nums text-muted-foreground">
              Page {page} / {pages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Suivant
            </Button>
          </div>
        )}
      </QueryState>
    </Page>
  )
}
