import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Copy, Globe, Mail, MessageCircle, MoreHorizontal, Pencil, Phone, Plus, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, Page, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useApiMutation } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { drapeau } from '@/lib/visit-format'
import { platformApi } from '../api'
import type { Paged } from '../types'

interface Prospect {
  id: string
  entreprise: string
  secteur: string | null
  pays: string | null
  ville: string | null
  contactNom: string | null
  telephone: string | null
  email: string | null
  canal: string | null
  site: string | null
  facebook: string | null
  instagram: string | null
  linkedin: string | null
  prioritaire: boolean
  statut: string
  prochaineActionDate: string | null
  prochaineActionNote: string | null
  dernierContact: string | null
  notes: string | null
}
interface Template {
  id: string
  canal: string
  objet: string | null
  corps: string
}

const STATUT: Record<string, string> = {
  a_contacter: 'À contacter',
  contacte: 'Contacté',
  a_relancer: 'À relancer',
  rdv: 'Rendez-vous',
  demo: 'Démo faite',
  client: 'Client',
  pas_interesse: 'Pas intéressé',
}
const STATUTS = Object.keys(STATUT)
const ALL = 'all'
const PAGE_SIZE = 50
const vide: Partial<Prospect> = { entreprise: '', statut: 'a_contacter', prioritaire: false }

const PAYS_CODE: Record<string, string> = {
  'Côte d’Ivoire': 'CI', "Côte d'Ivoire": 'CI', Sénégal: 'SN', Mali: 'ML', 'Burkina Faso': 'BF', Bénin: 'BJ', Togo: 'TG', Guinée: 'GN', Cameroun: 'CM',
}
const flagPays = (nom: string | null) => drapeau(PAYS_CODE[(nom ?? '').trim()])
const dateCourte = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : null)
const url = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)
const digits = (t: string | null) => (t ?? '').replace(/\D/g, '')

/** Prospection commerciale : entreprises à démarcher, contacts, étape, relances, historique. */
export function ProspectionPage() {
  const [statut, setStatut] = useState<string>(ALL)
  const [pays, setPays] = useState<string>(ALL)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Partial<Prospect> | null>(null)
  const [messaging, setMessaging] = useState<Prospect | null>(null)
  const [deleting, setDeleting] = useState<Prospect | null>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)

  const query = useQuery({
    queryKey: ['platform', 'prospects', { statut, pays, search, page }],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await platformApi.get<Paged<Prospect> & { counts: Record<string, number>; paysListe: string[] }>('/prospects', {
          params: { statut: statut === ALL ? undefined : statut, pays: pays === ALL ? undefined : pays, search: search || undefined, page, limit: PAGE_SIZE },
        })
      ).data,
  })
  const templates = useQuery({
    queryKey: ['platform', 'prospect-templates'],
    queryFn: async () => (await platformApi.get<Template[]>('/prospects/templates')).data,
  })

  const save = useApiMutation(
    (p: Partial<Prospect>) => (p.id ? platformApi.patch(`/prospects/${p.id}`, body(p)) : platformApi.post('/prospects', body(p))),
    { success: 'Prospect enregistré', invalidate: [['platform', 'prospects']], onSuccess: () => setEditing(null) },
  )
  const setStatutM = useApiMutation((v: { id: string; statut: string }) => platformApi.patch(`/prospects/${v.id}`, { statut: v.statut }), {
    success: 'Étape mise à jour',
    invalidate: [['platform', 'prospects']],
  })
  const remove = useApiMutation((id: string) => platformApi.delete(`/prospects/${id}`), {
    success: 'Prospect supprimé',
    invalidate: [['platform', 'prospects']],
    onSuccess: () => setDeleting(null),
  })

  const counts = query.data?.counts
  const paysListe = query.data?.paysListe ?? []
  const total = Object.values(counts ?? {}).reduce((a, b) => a + b, 0)

  return (
    <Page>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prospection</h1>
          <p className="mt-1 text-sm text-muted-foreground">Entreprises à démarcher : contacts, étape, relances et historique.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
            Modèles de message
          </Button>
          <Button onClick={() => setEditing({ ...vide })}>
            <Plus aria-hidden /> Ajouter
          </Button>
        </div>
      </div>

      <Tabs
        value={statut}
        onValueChange={(v) => {
          setStatut(v)
          setPage(1)
        }}
      >
        <TabsList className="flex-wrap">
          <TabsTrigger value={ALL}>Toutes{counts ? <span className="ml-1 text-xs text-muted-foreground tabular-nums">{total}</span> : null}</TabsTrigger>
          {STATUTS.map((srv) => (
            <TabsTrigger key={srv} value={srv}>
              {STATUT[srv]}
              {counts ? <span className="ml-1 text-xs text-muted-foreground tabular-nums">{counts[srv] ?? 0}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Select value={pays} onValueChange={(v) => { if (v) { setPays(v); setPage(1) } }}>
          <SelectTrigger className="h-9 w-44" aria-label="Pays">
            <SelectValue>{(v: string) => (v === ALL ? 'Tous les pays' : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les pays</SelectItem>
            {paysListe.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Rechercher une entreprise"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="max-w-xs"
        />
      </div>

      <QueryState query={query} rows={8}>
        {query.data?.items.length === 0 ? (
          <EmptyState icon={Users} title="Aucun prospect" description="Ajoutez une entreprise à démarcher, ou changez de filtre." />
        ) : (
          <div className={cn('overflow-x-auto rounded-lg border bg-card', query.isFetching && 'opacity-70')}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Entreprise</th>
                  <th className="px-4 py-3 font-medium">Contacts</th>
                  <th className="px-4 py-3 font-medium">Étape</th>
                  <th className="px-4 py-3 font-medium">Prochaine action</th>
                  <th className="px-4 py-3 font-medium">Dernier contact</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {query.data?.items.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 align-top hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.entreprise}</span>
                        {p.prioritaire && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Prioritaire</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {flagPays(p.pays) && <span className="mr-1">{flagPays(p.pays)}</span>}
                        {[p.pays, p.ville].filter(Boolean).join(' · ')}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Contacts p={p} />
                    </td>
                    <td className="px-4 py-3">
                      <Select value={p.statut} onValueChange={(v) => v && setStatutM.mutate({ id: p.id, statut: v })}>
                        <SelectTrigger className="h-8 w-36 border-none px-2 text-primary shadow-none hover:bg-muted" aria-label="Étape">
                          <SelectValue>{(v: string) => STATUT[v] ?? v}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUTS.map((srv) => (
                            <SelectItem key={srv} value={srv}>{STATUT[srv]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      {p.prochaineActionDate || p.prochaineActionNote ? (
                        <div>
                          {p.prochaineActionDate && <p className="font-medium">{dateCourte(p.prochaineActionDate)}</p>}
                          {p.prochaineActionNote && <p className="max-w-xs text-xs text-muted-foreground">{p.prochaineActionNote}</p>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p.dernierContact ? dateCourte(p.dernierContact) : <span className="text-muted-foreground">Jamais</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" aria-label="Options">
                              <MoreHorizontal aria-hidden />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setMessaging(p)}>
                            <MessageCircle aria-hidden /> Message
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditing(p)}>
                            <Pencil aria-hidden /> Modifier
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(p)}>
                            <Trash2 aria-hidden /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
      {query.data && (
        <Pagination
          page={query.data.page}
          pages={Math.max(1, Math.ceil(query.data.total / PAGE_SIZE))}
          total={query.data.total}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      )}

      {editing && <SaveDialog value={editing} saving={save.isPending} onClose={() => setEditing(null)} onSave={(p) => save.mutate(p)} />}
      {messaging && <MessageDialog prospect={messaging} templates={templates.data ?? []} onClose={() => setMessaging(null)} />}
      {templatesOpen && <TemplatesDialog templates={templates.data ?? []} onClose={() => setTemplatesOpen(false)} />}
      {deleting && (
        <Dialog open onOpenChange={(o) => !o && setDeleting(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Supprimer le prospect</DialogTitle>
              <DialogDescription>Supprimer « {deleting.entreprise} » ? Cette action est définitive.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)}>Annuler</Button>
              <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(deleting.id)}>Supprimer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Page>
  )
}

const IgIcon = () => (
  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
)
const FbIcon = () => (
  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
    <path d="M14 9h3V6h-3c-1.7 0-3 1.3-3 3v2H9v3h2v6h3v-6h2.5l.5-3H14V9z" />
  </svg>
)
const InIcon = () => (
  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
    <path d="M6.94 5a1.94 1.94 0 1 1-3.88 0 1.94 1.94 0 0 1 3.88 0zM3.5 8.5h3V21h-3V8.5zM9 8.5h2.9v1.7h.04c.4-.76 1.4-1.56 2.86-1.56 3.06 0 3.63 2 3.63 4.62V21h-3v-5.3c0-1.26-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.8V21H9V8.5z" />
  </svg>
)

function IconLink({ href, title, color, children }: { href: string; title: string; color?: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel="noreferrer"
      title={title}
      className={cn('flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/70', color)}
    >
      {children}
    </a>
  )
}

function Contacts({ p }: { p: Prospect }) {
  const d = digits(p.telephone)
  const any = p.telephone || p.email || p.site || p.instagram || p.facebook || p.linkedin
  if (!any) return <span className="text-sm text-muted-foreground">Aucun contact</span>
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {d && (
        <IconLink href={`https://wa.me/${d}`} title="WhatsApp" color="bg-green-500 text-white hover:bg-green-600">
          <MessageCircle className="size-4" aria-hidden />
        </IconLink>
      )}
      {p.telephone && (
        <IconLink href={`tel:${p.telephone}`} title={p.telephone}>
          <Phone className="size-4" aria-hidden />
        </IconLink>
      )}
      {p.email && (
        <IconLink href={`mailto:${p.email}`} title={p.email} color="bg-amber-100 text-amber-700 hover:bg-amber-200">
          <Mail className="size-4" aria-hidden />
        </IconLink>
      )}
      {p.site && (
        <IconLink href={url(p.site)} title="Site web">
          <Globe className="size-4" aria-hidden />
        </IconLink>
      )}
      {p.instagram && (
        <IconLink href={url(p.instagram)} title="Instagram"><IgIcon /></IconLink>
      )}
      {p.facebook && (
        <IconLink href={url(p.facebook)} title="Facebook"><FbIcon /></IconLink>
      )}
      {p.linkedin && (
        <IconLink href={url(p.linkedin)} title="LinkedIn"><InIcon /></IconLink>
      )}
    </div>
  )
}

function body(p: Partial<Prospect>) {
  return {
    entreprise: p.entreprise,
    secteur: p.secteur ?? null,
    pays: p.pays ?? null,
    ville: p.ville ?? null,
    contactNom: p.contactNom ?? null,
    telephone: p.telephone ?? null,
    email: p.email ?? null,
    canal: p.canal ?? null,
    site: p.site ?? null,
    facebook: p.facebook ?? null,
    instagram: p.instagram ?? null,
    linkedin: p.linkedin ?? null,
    prioritaire: p.prioritaire ?? false,
    statut: p.statut,
    prochaineActionDate: p.prochaineActionDate || null,
    prochaineActionNote: p.prochaineActionNote ?? null,
    notes: p.notes ?? null,
  }
}

function fill(t: string, p: Prospect) {
  return t.replaceAll('{{entreprise}}', p.entreprise).replaceAll('{{contact}}', p.contactNom || 'Madame, Monsieur')
}

function CopyButton({ text, label = 'Copier' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          /* presse-papiers indisponible */
        }
      }}
    >
      <Copy aria-hidden /> {done ? 'Copié !' : label}
    </Button>
  )
}

function SaveDialog({ value, saving, onClose, onSave }: { value: Partial<Prospect>; saving: boolean; onClose: () => void; onSave: (p: Partial<Prospect>) => void }) {
  const [p, setP] = useState<Partial<Prospect>>(value)
  const set = (k: keyof Prospect, v: string | boolean) => setP((prev) => ({ ...prev, [k]: v }))
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{value.id ? 'Modifier le prospect' : 'Nouveau prospect'}</DialogTitle>
          <DialogDescription>Les contacts (tél, e-mail, réseaux) ne sont pas obligatoires : ajoutez-les quand vous les avez.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[62vh] gap-3 overflow-y-auto pr-1">
          <Field label="Entreprise"><Input value={p.entreprise ?? ''} onChange={(e) => set('entreprise', e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!p.prioritaire} onChange={(e) => set('prioritaire', e.target.checked)} />
            <span>Prospect <strong>prioritaire</strong></span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Secteur"><Input value={p.secteur ?? ''} onChange={(e) => set('secteur', e.target.value)} /></Field>
            <Field label="Pays"><Input value={p.pays ?? ''} onChange={(e) => set('pays', e.target.value)} /></Field>
            <Field label="Ville"><Input value={p.ville ?? ''} onChange={(e) => set('ville', e.target.value)} /></Field>
            <Field label="Contact (nom)"><Input value={p.contactNom ?? ''} onChange={(e) => set('contactNom', e.target.value)} /></Field>
            <Field label="Téléphone / WhatsApp"><Input value={p.telephone ?? ''} onChange={(e) => set('telephone', e.target.value)} /></Field>
            <Field label="E-mail"><Input type="email" value={p.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Site web"><Input value={p.site ?? ''} onChange={(e) => set('site', e.target.value)} /></Field>
            <Field label="LinkedIn"><Input value={p.linkedin ?? ''} onChange={(e) => set('linkedin', e.target.value)} /></Field>
            <Field label="Facebook"><Input value={p.facebook ?? ''} onChange={(e) => set('facebook', e.target.value)} /></Field>
            <Field label="Instagram"><Input value={p.instagram ?? ''} onChange={(e) => set('instagram', e.target.value)} /></Field>
          </div>
          <Field label="Étape">
            <Select value={p.statut ?? 'a_contacter'} onValueChange={(v) => v && set('statut', v)}>
              <SelectTrigger><SelectValue>{(v: string) => STATUT[v] ?? v}</SelectValue></SelectTrigger>
              <SelectContent>{STATUTS.map((srv) => <SelectItem key={srv} value={srv}>{STATUT[srv]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <Field label="Prochaine action"><Input type="date" value={p.prochaineActionDate ?? ''} onChange={(e) => set('prochaineActionDate', e.target.value)} /></Field>
            <Field label="Note de l’action"><Input value={p.prochaineActionNote ?? ''} onChange={(e) => set('prochaineActionNote', e.target.value)} placeholder="Ex. Relancer pour fixer la démo" /></Field>
          </div>
          <Field label="Notes"><Textarea rows={2} value={p.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={saving || !p.entreprise?.trim()} onClick={() => onSave(p)}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MessageDialog({ prospect, templates, onClose }: { prospect: Prospect; templates: Template[]; onClose: () => void }) {
  const email = templates.find((t) => t.canal === 'email')
  const whatsapp = templates.find((t) => t.canal === 'whatsapp')
  const tracer = (t: string) => t.replaceAll('performx.online/video', `performx.online/video?p=${prospect.id}`)
  const emailObjet = email ? fill(email.objet ?? '', prospect) : ''
  const emailCorps = email ? tracer(fill(email.corps, prospect)) : ''
  const waCorps = whatsapp ? tracer(fill(whatsapp.corps, prospect)) : ''
  const d = digits(prospect.telephone)
  const waLink = d ? `https://wa.me/${d}?text=${encodeURIComponent(waCorps)}` : null
  const mailLink = prospect.email ? `mailto:${prospect.email}?subject=${encodeURIComponent(emailObjet)}&body=${encodeURIComponent(emailCorps)}` : null

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Message · {prospect.entreprise}</DialogTitle>
          <DialogDescription>{prospect.contactNom ? `${prospect.contactNom} · ` : ''}{prospect.canal ?? 'canal non précisé'}</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-5 overflow-y-auto pr-1">
          <section className="grid gap-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Mail className="size-4" aria-hidden /> E-mail</h3>
              <div className="flex gap-1.5">
                <CopyButton text={`${emailObjet}\n\n${emailCorps}`} />
                {mailLink && <Button size="sm" render={<a href={mailLink} />}>Ouvrir l’e-mail</Button>}
              </div>
            </div>
            <Input readOnly value={emailObjet} aria-label="Objet" />
            <Textarea readOnly rows={8} value={emailCorps} className="text-sm" />
          </section>
          <section className="grid gap-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold"><MessageCircle className="size-4" aria-hidden /> WhatsApp</h3>
              <div className="flex gap-1.5">
                <CopyButton text={waCorps} />
                {waLink ? (
                  <Button size="sm" render={<a href={waLink} target="_blank" rel="noreferrer" />}>Ouvrir WhatsApp</Button>
                ) : (
                  <Button size="sm" disabled title="Ajoutez un numéro">Ouvrir WhatsApp</Button>
                )}
              </div>
            </div>
            <Textarea readOnly rows={4} value={waCorps} className="text-sm" />
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TemplatesDialog({ templates, onClose }: { templates: Template[]; onClose: () => void }) {
  const email = templates.find((t) => t.canal === 'email')
  const whatsapp = templates.find((t) => t.canal === 'whatsapp')
  const [emailObjet, setEmailObjet] = useState(email?.objet ?? '')
  const [emailCorps, setEmailCorps] = useState(email?.corps ?? '')
  const [waCorps, setWaCorps] = useState(whatsapp?.corps ?? '')
  const save = useApiMutation(
    (t: { id: string; objet?: string | null; corps: string }) => platformApi.patch(`/prospects/templates/${t.id}`, { objet: t.objet, corps: t.corps }),
    { success: 'Modèle enregistré', invalidate: [['platform', 'prospect-templates']] },
  )
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Modèles de message</DialogTitle>
          <DialogDescription>Variables : <code>{'{{entreprise}}'}</code> et <code>{'{{contact}}'}</code>, remplacées par prospect.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-5 overflow-y-auto pr-1">
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">E-mail</h3>
            <Field label="Objet"><Input value={emailObjet} onChange={(e) => setEmailObjet(e.target.value)} /></Field>
            <Field label="Corps"><Textarea rows={8} value={emailCorps} onChange={(e) => setEmailCorps(e.target.value)} className="text-sm" /></Field>
            {email && <div className="flex justify-end"><Button size="sm" disabled={save.isPending} onClick={() => save.mutate({ id: email.id, objet: emailObjet, corps: emailCorps })}>Enregistrer l’e-mail</Button></div>}
          </section>
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">WhatsApp</h3>
            <Field label="Message"><Textarea rows={4} value={waCorps} onChange={(e) => setWaCorps(e.target.value)} className="text-sm" /></Field>
            {whatsapp && <div className="flex justify-end"><Button size="sm" disabled={save.isPending} onClick={() => save.mutate({ id: whatsapp.id, objet: null, corps: waCorps })}>Enregistrer le WhatsApp</Button></div>}
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
