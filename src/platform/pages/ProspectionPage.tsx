import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Copy, Mail, MessageCircle, MoreHorizontal, Pencil, Target, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, Page, PageHeader, QueryState } from '@/components/app/page'
import { Pagination } from '@/components/app/pagination'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useApiMutation } from '@/lib/queries'
import { cn } from '@/lib/utils'
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
  statut: string
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
  relance: 'Relancé',
  interesse: 'Intéressé',
  rdv: 'RDV',
  gagne: 'Client',
  perdu: 'Sans suite',
}
const STATUTS = Object.keys(STATUT)
const ALL = 'all'
const PAGE_SIZE = 30
const vide: Partial<Prospect> = { entreprise: '', statut: 'a_contacter' }

/** Prospection commerciale : entreprises à démarcher, contacts, statuts, messages prêts. */
export function ProspectionPage() {
  const [statut, setStatut] = useState<string>(ALL)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Partial<Prospect> | null>(null)
  const [messaging, setMessaging] = useState<Prospect | null>(null)
  const [deleting, setDeleting] = useState<Prospect | null>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)

  const query = useQuery({
    queryKey: ['platform', 'prospects', { statut, search, page }],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await platformApi.get<Paged<Prospect> & { counts: Record<string, number> }>('/prospects', {
          params: { statut: statut === ALL ? undefined : statut, search: search || undefined, page, limit: PAGE_SIZE },
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
    success: 'Statut mis à jour',
    invalidate: [['platform', 'prospects']],
  })
  const remove = useApiMutation((id: string) => platformApi.delete(`/prospects/${id}`), {
    success: 'Prospect supprimé',
    invalidate: [['platform', 'prospects']],
    onSuccess: () => setDeleting(null),
  })

  const counts = query.data?.counts
  return (
    <Page>
      <PageHeader
        title="Prospection"
        description="Entreprises à démarcher pour PerformX : contacts, statut d’avancement et messages e-mail / WhatsApp prêts à envoyer."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
              Modèles de message
            </Button>
            <Button onClick={() => setEditing({ ...vide })}>
              <Target aria-hidden /> Nouveau prospect
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Rechercher (entreprise, contact, ville…)"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="max-w-xs"
        />
      </div>

      <Tabs
        value={statut}
        onValueChange={(v) => {
          setStatut(v)
          setPage(1)
        }}
      >
        <TabsList className="flex-wrap">
          <TabsTrigger value={ALL}>Tous</TabsTrigger>
          {STATUTS.map((s) => (
            <TabsTrigger key={s} value={s}>
              {STATUT[s]}
              {counts?.[s] ? <span className="ml-1 text-xs text-muted-foreground tabular-nums">{counts[s]}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <QueryState query={query} rows={6}>
        {query.data?.items.length === 0 ? (
          <EmptyState icon={Users} title="Aucun prospect" description="Ajoutez une entreprise à démarcher, ou changez de filtre." />
        ) : (
          <div className={cn('overflow-x-auto rounded-lg border bg-card', query.isFetching && 'opacity-70')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entreprise</TableHead>
                  <TableHead>Pays / Ville</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data?.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <p className="font-medium">{p.entreprise}</p>
                      <p className="text-xs text-muted-foreground">{p.secteur ?? '—'}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      <p>{p.pays ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{p.ville ?? ''}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.contactNom || p.telephone || p.email ? (
                        <>
                          {p.contactNom && <p className="font-medium">{p.contactNom}</p>}
                          <p className="text-xs text-muted-foreground">
                            {p.telephone ?? ''}
                            {p.telephone && p.email ? ' · ' : ''}
                            {p.email ?? ''}
                          </p>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">à compléter</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.canal ?? '—'}</TableCell>
                    <TableCell>
                      <Select value={p.statut} onValueChange={(v) => v && setStatutM.mutate({ id: p.id, statut: v })}>
                        <SelectTrigger className="h-8 w-36" aria-label="Statut">
                          <SelectValue>{(v: string) => STATUT[v] ?? v}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUTS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUT[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => setMessaging(p)}>
                          <MessageCircle aria-hidden /> Message
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon-sm" aria-label="Options">
                                <MoreHorizontal aria-hidden />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditing(p)}>
                              <Pencil aria-hidden /> Modifier
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(p)}>
                              <Trash2 aria-hidden /> Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
              <Button variant="outline" onClick={() => setDeleting(null)}>
                Annuler
              </Button>
              <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(deleting.id)}>
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Page>
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
    statut: p.statut,
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

function SaveDialog({
  value,
  saving,
  onClose,
  onSave,
}: {
  value: Partial<Prospect>
  saving: boolean
  onClose: () => void
  onSave: (p: Partial<Prospect>) => void
}) {
  const [p, setP] = useState<Partial<Prospect>>(value)
  const set = (k: keyof Prospect, v: string) => setP((prev) => ({ ...prev, [k]: v }))
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{value.id ? 'Modifier le prospect' : 'Nouveau prospect'}</DialogTitle>
          <DialogDescription>Les e-mails et numéros ne sont pas obligatoires : ajoutez-les quand vous les avez.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
          <Field label="Entreprise">
            <Input value={p.entreprise ?? ''} onChange={(e) => set('entreprise', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Secteur">
              <Input value={p.secteur ?? ''} onChange={(e) => set('secteur', e.target.value)} />
            </Field>
            <Field label="Canal privilégié">
              <Input placeholder="WhatsApp, LinkedIn…" value={p.canal ?? ''} onChange={(e) => set('canal', e.target.value)} />
            </Field>
            <Field label="Pays">
              <Input value={p.pays ?? ''} onChange={(e) => set('pays', e.target.value)} />
            </Field>
            <Field label="Ville">
              <Input value={p.ville ?? ''} onChange={(e) => set('ville', e.target.value)} />
            </Field>
          </div>
          <Field label="Contact (nom)">
            <Input value={p.contactNom ?? ''} onChange={(e) => set('contactNom', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Téléphone / WhatsApp">
              <Input value={p.telephone ?? ''} onChange={(e) => set('telephone', e.target.value)} />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={p.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </Field>
          </div>
          <Field label="Statut">
            <Select value={p.statut ?? 'a_contacter'} onValueChange={(v) => v && set('statut', v)}>
              <SelectTrigger>
                <SelectValue>{(v: string) => STATUT[v] ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUT[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notes">
            <Textarea rows={3} value={p.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={saving || !p.entreprise?.trim()} onClick={() => onSave(p)}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MessageDialog({ prospect, templates, onClose }: { prospect: Prospect; templates: Template[]; onClose: () => void }) {
  const email = templates.find((t) => t.canal === 'email')
  const whatsapp = templates.find((t) => t.canal === 'whatsapp')
  const emailObjet = email ? fill(email.objet ?? '', prospect) : ''
  const emailCorps = email ? fill(email.corps, prospect) : ''
  const waCorps = whatsapp ? fill(whatsapp.corps, prospect) : ''
  const digits = (prospect.telephone ?? '').replace(/\D/g, '')
  const waLink = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(waCorps)}` : null
  const mailLink = prospect.email ? `mailto:${prospect.email}?subject=${encodeURIComponent(emailObjet)}&body=${encodeURIComponent(emailCorps)}` : null

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Message · {prospect.entreprise}</DialogTitle>
          <DialogDescription>
            {prospect.contactNom ? `${prospect.contactNom} · ` : ''}
            {prospect.canal ?? 'canal non précisé'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-5 overflow-y-auto pr-1">
          <section className="grid gap-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Mail className="size-4" aria-hidden /> E-mail
              </h3>
              <div className="flex gap-1.5">
                <CopyButton text={`${emailObjet}\n\n${emailCorps}`} />
                {mailLink && (
                  <Button size="sm" render={<a href={mailLink} />}>
                    Ouvrir l’e-mail
                  </Button>
                )}
              </div>
            </div>
            <Input readOnly value={emailObjet} aria-label="Objet" />
            <Textarea readOnly rows={8} value={emailCorps} className="text-sm" />
          </section>
          <section className="grid gap-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <MessageCircle className="size-4" aria-hidden /> WhatsApp
              </h3>
              <div className="flex gap-1.5">
                <CopyButton text={waCorps} />
                {waLink ? (
                  <Button size="sm" render={<a href={waLink} target="_blank" rel="noreferrer" />}>
                    Ouvrir WhatsApp
                  </Button>
                ) : (
                  <Button size="sm" disabled title="Ajoutez un numéro pour ouvrir WhatsApp">
                    Ouvrir WhatsApp
                  </Button>
                )}
              </div>
            </div>
            <Textarea readOnly rows={4} value={waCorps} className="text-sm" />
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
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
          <DialogDescription>
            Variables disponibles : <code>{'{{entreprise}}'}</code> et <code>{'{{contact}}'}</code> (remplacées automatiquement par prospect).
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-5 overflow-y-auto pr-1">
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">E-mail</h3>
            <Field label="Objet">
              <Input value={emailObjet} onChange={(e) => setEmailObjet(e.target.value)} />
            </Field>
            <Field label="Corps">
              <Textarea rows={8} value={emailCorps} onChange={(e) => setEmailCorps(e.target.value)} className="text-sm" />
            </Field>
            {email && (
              <div className="flex justify-end">
                <Button size="sm" disabled={save.isPending} onClick={() => save.mutate({ id: email.id, objet: emailObjet, corps: emailCorps })}>
                  Enregistrer l’e-mail
                </Button>
              </div>
            )}
          </section>
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">WhatsApp</h3>
            <Field label="Message">
              <Textarea rows={4} value={waCorps} onChange={(e) => setWaCorps(e.target.value)} className="text-sm" />
            </Field>
            {whatsapp && (
              <div className="flex justify-end">
                <Button size="sm" disabled={save.isPending} onClick={() => save.mutate({ id: whatsapp.id, objet: null, corps: waCorps })}>
                  Enregistrer le WhatsApp
                </Button>
              </div>
            )}
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
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
