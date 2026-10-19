import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, Copy, ExternalLink, KeyRound, Link2, Link2Off, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { Page, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime, formatPhone } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { PresentationView } from '@/presentation/PresentationView'
import { shareUrl, type DemoAccount, type Presentation, type PresentationContent } from '@/presentation/types'
import { platformApi } from '../api'
import { to } from '../config'

const COLOR = /^#[0-9A-Fa-f]{6}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Liste saisie en texte : une valeur par ligne (ou séparées par des virgules). */
const toList = (text: string, max: number, length: number) =>
  text
    .split(/[\n,]/)
    .map((s) => s.trim().slice(0, length))
    .filter(Boolean)
    .slice(0, max)

/** Forme comparable (la base renvoie les clés dans un autre ordre). */
const canonical = (c: PresentationContent) =>
  JSON.stringify([
    c.clientName,
    c.trade,
    c.city,
    c.areas,
    c.agents,
    c.leads,
    c.products,
    c.outletWord,
    [c.modules.missions, c.modules.outlets, c.modules.orders, c.modules.pay],
    c.agentName,
    c.presenter,
    c.meetingDate,
    c.color,
    c.supportEmail,
    c.supportPhone,
  ])

const MODULES: { key: keyof PresentationContent['modules']; label: string; hint: string }[] = [
  { key: 'missions', label: 'Missions', hint: 'Objectifs et formulaires à remplir sur le terrain' },
  { key: 'outlets', label: 'Points de vente', hint: 'Tournée, visites et relevés de produits' },
  { key: 'orders', label: 'Commandes', hint: 'Prise de commande, livraison et paiement' },
  { key: 'pay', label: 'Rémunération', hint: 'Paie et primes calculées' },
]

/** Formulaire du client à gauche, aperçu de la présentation à droite (mis à jour en direct). */
export function PresentationPage() {
  const { id = '' } = useParams()
  const query = useQuery({
    queryKey: ['platform', 'presentations', id],
    queryFn: async () => (await platformApi.get<Presentation>(`/presentations/${id}`)).data,
  })
  return (
    <Page>
      <Link to={to('/presentations')} className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Présentations
      </Link>
      <QueryState query={query}>{query.data && <Editor key={query.data.id} presentation={query.data} />}</QueryState>
    </Page>
  )
}

function Editor({ presentation }: { presentation: Presentation }) {
  const [draft, setDraft] = useState<PresentationContent>(presentation.content)
  const [areas, setAreas] = useState(presentation.content.areas.join('\n'))
  const [products, setProducts] = useState(presentation.content.products.join('\n'))
  const content = useMemo(() => ({ ...draft, areas: toList(areas, 12, 40), products: toList(products, 10, 60) }), [draft, areas, products])
  const dirty = canonical(content) !== canonical(presentation.content)

  // Quitter la page avec des modifications non enregistrées.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const errors = {
    clientName: content.clientName.trim().length < 2 ? 'Au moins 2 caractères' : null,
    color: COLOR.test(content.color) ? null : 'Couleur au format #RRGGBB',
    supportEmail: content.supportEmail && !EMAIL.test(content.supportEmail) ? 'Adresse e-mail invalide' : null,
  }
  const valid = !Object.values(errors).some(Boolean)
  const set = <K extends keyof PresentationContent>(key: K, value: PresentationContent[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const save = useApiMutation(() => platformApi.patch<Presentation>(`/presentations/${presentation.id}`, { content }), {
    success: 'Présentation enregistrée',
    invalidate: [['platform', 'presentations']],
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-balance">{presentation.content.clientName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {presentation.tenantName ? `Structure : ${presentation.tenantName}` : 'Nouveau client'} · modifiée le{' '}
            {formatDateTime(presentation.updatedAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!dirty}
            onClick={() => {
              setDraft(presentation.content)
              setAreas(presentation.content.areas.join('\n'))
              setProducts(presentation.content.products.join('\n'))
            }}
          >
            Annuler
          </Button>
          <Button disabled={!dirty || !valid || save.isPending} onClick={() => save.mutate(undefined)}>
            Enregistrer
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <ShareCard presentation={presentation} dirty={dirty} />
          <DemoCard presentation={presentation} dirty={dirty} />

          <Section title="Le client">
            <Field id="clientName" label="Nom du client" error={errors.clientName}>
              <Input
                id="clientName"
                value={draft.clientName}
                maxLength={80}
                aria-invalid={!!errors.clientName}
                onChange={(e) => set('clientName', e.target.value)}
              />
            </Field>
            <Field id="trade" label="Métier" hint="Ex. distribution de boissons">
              <Input id="trade" value={draft.trade} maxLength={80} onChange={(e) => set('trade', e.target.value)} />
            </Field>
            <Field id="city" label="Ville">
              <Input id="city" value={draft.city} maxLength={60} onChange={(e) => set('city', e.target.value)} />
            </Field>
            <Field id="areas" label="Quartiers de travail" hint="Un par ligne (12 au plus). Le premier sert d’exemple.">
              <Textarea id="areas" rows={3} value={areas} onChange={(e) => setAreas(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="agents" label="Agents">
                <Input
                  id="agents"
                  type="number"
                  min={0}
                  max={100000}
                  value={draft.agents}
                  onChange={(e) => set('agents', Math.max(0, Math.min(100000, Math.trunc(Number(e.target.value) || 0))))}
                />
              </Field>
              <Field id="leads" label="Chefs d’équipe">
                <Input
                  id="leads"
                  type="number"
                  min={0}
                  max={10000}
                  value={draft.leads}
                  onChange={(e) => set('leads', Math.max(0, Math.min(10000, Math.trunc(Number(e.target.value) || 0))))}
                />
              </Field>
            </div>
          </Section>

          <Section title="Ce qu’on présente">
            <div className="flex flex-col gap-3">
              {MODULES.map((m) => (
                <label key={m.key} className="flex items-start gap-3">
                  <Switch
                    className="mt-0.5"
                    checked={draft.modules[m.key]}
                    onCheckedChange={(v) => set('modules', { ...draft.modules, [m.key]: v })}
                  />
                  <span>
                    <span className="block text-sm font-medium">{m.label}</span>
                    <span className="block text-xs text-muted-foreground">{m.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <Field id="outletWord" label="Ses points de vente, en ses mots" hint="Ex. boutiques, maquis et supérettes">
              <Input id="outletWord" value={draft.outletWord} maxLength={80} onChange={(e) => set('outletWord', e.target.value)} />
            </Field>
            <Field id="products" label="Produits à citer" hint="Un par ligne (10 au plus).">
              <Textarea id="products" rows={3} value={products} onChange={(e) => setProducts(e.target.value)} />
            </Field>
            <Field id="agentName" label="Prénom de l’agent d’exemple" hint="Le fil rouge de « la journée type ».">
              <Input id="agentName" value={draft.agentName} maxLength={40} onChange={(e) => set('agentName', e.target.value)} />
            </Field>
          </Section>

          <Section title="La réunion">
            <div className="grid grid-cols-2 gap-3">
              <Field id="presenter" label="Présentateur">
                <Input id="presenter" value={draft.presenter} maxLength={60} onChange={(e) => set('presenter', e.target.value)} />
              </Field>
              <Field id="meetingDate" label="Date">
                <Input
                  id="meetingDate"
                  type="date"
                  value={draft.meetingDate ?? ''}
                  onChange={(e) => set('meetingDate', e.target.value || null)}
                />
              </Field>
            </div>
            <Field id="color" label="Couleur" error={errors.color} hint="Celle du client, pour les couvertures et les repères.">
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label="Choisir la couleur"
                  className="h-9 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
                  value={COLOR.test(draft.color) ? draft.color : '#2563eb'}
                  onChange={(e) => set('color', e.target.value.toUpperCase())}
                />
                <Input
                  id="color"
                  value={draft.color}
                  maxLength={7}
                  aria-invalid={!!errors.color}
                  onChange={(e) => set('color', e.target.value.toUpperCase())}
                />
              </div>
            </Field>
            <Field id="supportEmail" label="E-mail d’assistance" error={errors.supportEmail}>
              <Input
                id="supportEmail"
                type="email"
                value={draft.supportEmail}
                maxLength={120}
                aria-invalid={!!errors.supportEmail}
                onChange={(e) => set('supportEmail', e.target.value.trim())}
              />
            </Field>
            <Field id="supportPhone" label="Téléphone d’assistance">
              <Input
                id="supportPhone"
                type="tel"
                value={draft.supportPhone}
                maxLength={30}
                onChange={(e) => set('supportPhone', e.target.value)}
              />
            </Field>
          </Section>
        </div>

        <div className="overflow-hidden rounded-xl border xl:sticky xl:top-4">
          <p className="border-b bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
            Aperçu en direct{dirty ? ' · modifications non enregistrées' : ''}
          </p>
          <div className="max-h-[calc(100svh-7rem)] overflow-y-auto">
            <PresentationView content={content} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Lien à envoyer au client : ouvert sans compte, sans le déroulé ni les notes du présentateur. */
function ShareCard({ presentation, dirty }: { presentation: Presentation; dirty: boolean }) {
  const invalidate = [['platform', 'presentations']]
  const share = useApiMutation(() => platformApi.post(`/presentations/${presentation.id}/share`), {
    success: 'Lien de partage créé',
    invalidate,
  })
  const unshare = useApiMutation(() => platformApi.delete(`/presentations/${presentation.id}/share`), {
    success: 'Lien retiré : il ne fonctionne plus',
    invalidate,
  })
  const url = presentation.shareToken ? shareUrl(presentation.shareToken) : null

  return (
    <Section title="Partager avec le client">
      {url ? (
        <>
          <div className="flex gap-2">
            <Input readOnly value={url} aria-label="Lien de partage" onFocus={(e) => e.target.select()} />
            <Button
              variant="outline"
              size="icon"
              aria-label="Copier le lien"
              onClick={() =>
                void navigator.clipboard.writeText(url).then(
                  () => toast.success('Lien copié'),
                  () => toast.error('Copie impossible : sélectionnez le lien'),
                )
              }
            >
              <Copy aria-hidden />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ouvert {presentation.viewCount} fois
            {presentation.lastViewedAt ? `, la dernière le ${formatDateTime(presentation.lastViewedAt)}` : ''}. Le client voit le diaporama,
            les fiches et la liste de démarrage, sans le déroulé ni vos notes.
          </p>
          {dirty && <p className="text-xs text-amber-700 dark:text-amber-400">Enregistrez pour que le lien montre vos modifications.</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" nativeButton={false} render={<a href={url} target="_blank" rel="noopener noreferrer" />}>
              <ExternalLink aria-hidden /> Ouvrir
            </Button>
            <Button variant="outline" size="sm" disabled={unshare.isPending} onClick={() => unshare.mutate(undefined)}>
              <Link2Off aria-hidden /> Retirer le lien
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Un lien secret, à envoyer au client après la réunion : il retrouve la présentation et peut imprimer les fiches.
          </p>
          <Button className="w-fit" disabled={share.isPending} onClick={() => share.mutate(undefined)}>
            <Link2 aria-hidden /> Créer le lien de partage
          </Button>
        </>
      )}
    </Section>
  )
}

const ROLE: Record<DemoAccount['role'], string> = { admin: 'Responsable', team_lead: 'Chef d’équipe', agent: 'Agent' }

/** Comptes de la démo à copier d'un bloc (pour les noter avant la réunion). */
const accountsText = (accounts: DemoAccount[], password?: string) =>
  [
    ...accounts.map((a) => `${ROLE[a.role]} · ${a.name} · ${a.role === 'admin' ? a.email : formatPhone(a.phone)}`),
    ...(password ? [`Mot de passe de tous les comptes : ${password}`] : []),
  ].join('\n')

/**
 * Structure de démonstration du client, créée en un clic à partir de la présentation
 * (enregistrée) : nom, couleur, quartiers, produits, équipe et quelques jours d'activité.
 */
function DemoCard({ presentation, dirty }: { presentation: Presentation; dirty: boolean }) {
  const queryClient = useQueryClient()
  const [shown, setShown] = useState<{ password?: string; accounts: DemoAccount[] } | null>(null)
  const [removing, setRemoving] = useState(false)
  const base = `/presentations/${presentation.id}/demo`
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['platform', 'presentations'] })
  const create = useApiMutation(async () => (await platformApi.post<{ password: string; accounts: DemoAccount[] }>(base)).data, {
    success: 'Structure de démo créée',
    onSuccess: (r) => {
      refresh()
      setShown(r)
    },
  })
  const accounts = useApiMutation(async () => (await platformApi.get<{ accounts: DemoAccount[] }>(base)).data, {
    onSuccess: (r) => setShown(r),
  })
  const reset = useApiMutation(
    async () => (await platformApi.post<{ password: string; accounts: DemoAccount[] }>(`${base}/password`)).data,
    {
      success: 'Nouveau mot de passe pour tous les comptes de la démo',
      onSuccess: (r) => setShown(r),
    },
  )
  const remove = useApiMutation(() => platformApi.delete(base), {
    success: 'Structure de démo supprimée',
    onSuccess: () => {
      refresh()
      setRemoving(false)
    },
  })
  const c = presentation.content

  return (
    <Section title="Structure de démo">
      {presentation.demoTenantId ? (
        <>
          <p className="text-sm">
            <span className="font-medium">{presentation.demoTenantName}</span>
            <span className="block text-xs text-muted-foreground">
              Créée le {formatDateTime(presentation.demoCreatedAt)} · responsable : {presentation.demoAdminEmail}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={accounts.isPending} onClick={() => accounts.mutate(undefined)}>
              <Users aria-hidden /> Comptes
            </Button>
            <Button variant="outline" size="sm" disabled={reset.isPending} onClick={() => reset.mutate(undefined)}>
              <KeyRound aria-hidden /> Nouveau mot de passe
            </Button>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link to={to(`/tenants/${presentation.demoTenantId}`)} />}>
              <Building2 aria-hidden /> Fiche
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRemoving(true)}>
              <Trash2 aria-hidden /> Supprimer
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Une structure prête pour la démonstration : « {c.clientName} · Démo », à sa couleur, avec ses quartiers, ses produits, une
            équipe de {Math.max(4, Math.min(12, c.agents || 4))} agents et 6 jours d’activité. La journée en cours est visible sur la carte
            en direct.
          </p>
          {dirty && (
            <p className="text-xs text-amber-700 dark:text-amber-400">Enregistrez d’abord : la démo reprend la version enregistrée.</p>
          )}
          <Button className="w-fit" disabled={dirty || create.isPending} onClick={() => create.mutate(undefined)}>
            <Building2 aria-hidden /> {create.isPending ? 'Création…' : 'Créer la structure de démo'}
          </Button>
        </>
      )}

      <Dialog open={!!shown} onOpenChange={(o) => !o && setShown(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comptes de la démo</DialogTitle>
            <DialogDescription>
              Le responsable se connecte sur le site avec son e-mail ; les chefs et les agents dans l’app avec leur numéro.
              {shown?.password ? ' Notez le mot de passe : il n’est montré qu’une fois.' : ''}
            </DialogDescription>
          </DialogHeader>
          {shown?.password && (
            <p className="rounded-lg border bg-muted/50 px-3 py-2 text-sm">
              Mot de passe de tous les comptes : <span className="font-mono font-semibold select-all">{shown.password}</span>
            </p>
          )}
          <div className="max-h-[50vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Connexion</TableHead>
                  <TableHead>Équipe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown?.accounts.map((a) => (
                  <TableRow key={a.email}>
                    <TableCell>{ROLE[a.role]}</TableCell>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="font-mono text-xs">{a.role === 'admin' ? a.email : formatPhone(a.phone)}</TableCell>
                    <TableCell className="text-muted-foreground">{a.group ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                shown &&
                void navigator.clipboard.writeText(accountsText(shown.accounts, shown.password)).then(
                  () => toast.success('Comptes copiés'),
                  () => toast.error('Copie impossible'),
                )
              }
            >
              <Copy aria-hidden /> Copier
            </Button>
            <Button onClick={() => setShown(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removing} onOpenChange={(o) => !o && setRemoving(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer la structure de démo ?</DialogTitle>
            <DialogDescription>
              « {presentation.demoTenantName} » et toutes ses données (comptes, journées, formulaires) sont supprimées définitivement. Vous
              pourrez en recréer une.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(false)}>
              Annuler
            </Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(undefined)}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  )
}
