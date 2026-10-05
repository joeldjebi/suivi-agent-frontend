import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Page, PageHeader, QueryState } from '@/components/app/page'
import { StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatRelative, fullName } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { CheckCircle2, CircleSlash, ShieldCheck, ShieldOff } from 'lucide-react'
import { platformApi } from '../api'
import { usePlatformAdmin } from '../auth'
import type { PlatformAdmin } from '../types'

export function AdminsPage() {
  const me = usePlatformAdmin()
  const [creating, setCreating] = useState(false)
  const [resetting, setResetting] = useState<PlatformAdmin | null>(null)
  const reset = useApiMutation((id: string) => platformApi.post(`/admins/${id}/mfa-reset`), {
    success: 'Double authentification réinitialisée : la personne la réactivera à sa prochaine connexion',
    invalidate: [['platform', 'admins']],
    onSuccess: () => setResetting(null),
  })
  const query = useQuery({
    queryKey: ['platform', 'admins'],
    queryFn: async () => (await platformApi.get<PlatformAdmin[]>('/admins')).data,
  })
  const toggle = useApiMutation(({ id, isActive }: { id: string; isActive: boolean }) => platformApi.patch(`/admins/${id}`, { isActive }), {
    success: 'Compte mis à jour',
    invalidate: [['platform', 'admins']],
  })
  return (
    <Page>
      <PageHeader
        title="Comptes éditeur"
        description="Personnes de l’équipe Suivi Agent qui accèdent à cette console. Désactiver un compte ferme immédiatement ses sessions."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden /> Nouveau compte
          </Button>
        }
      />
      <QueryState query={query}>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personne</TableHead>
                <TableHead>Dernière connexion</TableHead>
                <TableHead>Double authentification</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Accès</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data?.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <p className="font-medium">
                      {fullName(a)}
                      {a.id === me.id && <span className="ml-2 text-xs font-normal text-muted-foreground">(vous)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.email} · créé le {formatDate(a.createdAt)}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">{a.lastLoginAt ? formatRelative(a.lastLoginAt) : 'Jamais'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {a.mfaEnabledAt ? (
                        <StatusPill tone="active" icon={ShieldCheck} label="Active" />
                      ) : (
                        <StatusPill tone="paused" icon={ShieldOff} label="Inactive" />
                      )}
                      {a.mfaEnabledAt && a.id !== me.id && (
                        <Button size="sm" variant="ghost" onClick={() => setResetting(a)}>
                          Réinitialiser
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {a.isActive ? (
                      <StatusPill tone="active" icon={CheckCircle2} label="Actif" />
                    ) : (
                      <StatusPill tone="ended" icon={CircleSlash} label="Désactivé" />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={a.isActive}
                      disabled={a.id === me.id || toggle.isPending}
                      aria-label={`${a.isActive ? 'Désactiver' : 'Réactiver'} ${fullName(a)}`}
                      onCheckedChange={(isActive) => toggle.mutate({ id: a.id, isActive })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </QueryState>
      {creating && <CreateDialog onClose={() => setCreating(false)} />}
      <Dialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Réinitialiser la double authentification de {resetting && fullName(resetting)} ?</DialogTitle>
            <DialogDescription>
              À faire seulement après avoir vérifié son identité (téléphone perdu ou changé). Ses sessions sont fermées ; elle se connectera
              avec son mot de passe puis réactivera la double authentification.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetting(null)}>
              Annuler
            </Button>
            <Button variant="destructive" disabled={reset.isPending} onClick={() => resetting && reset.mutate(resetting.id)}>
              Réinitialiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const [v, setV] = useState({ firstName: '', lastName: '', email: '', password: '' })
  const save = useApiMutation(() => platformApi.post('/admins', { ...v, email: v.email.trim() }), {
    success: 'Compte créé : transmettez le mot de passe par un canal sûr',
    invalidate: [['platform', 'admins']],
    onSuccess: onClose,
  })
  const valid = v.firstName.trim() && v.lastName.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email.trim()) && v.password.length >= 10
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau compte éditeur</DialogTitle>
          <DialogDescription>Accès complet à la console : toutes les structures, leurs abonnements et leurs factures.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adm-first">Prénom</Label>
            <Input id="adm-first" value={v.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adm-last">Nom</Label>
            <Input id="adm-last" value={v.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="adm-email">Email</Label>
            <Input id="adm-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="adm-password">Mot de passe provisoire (10 caractères minimum)</Label>
            <Input
              id="adm-password"
              type="text"
              autoComplete="off"
              value={v.password}
              onChange={(e) => setV({ ...v, password: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate(undefined)}>
            Créer le compte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
