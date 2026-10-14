import { OutletStatus, Role } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  ClipboardCheck,
  Combine,
  ImageOff,
  Loader2,
  MapPin,
  MoreHorizontal,
  Move,
  PenLine,
  Phone,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { QueryState } from '@/components/app/page'
import { SearchInput } from '@/components/app/search-input'
import { StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { formatDateTime, formatPhone, formatRelative } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { usePhotoUrl } from '@/lib/use-photo-url'
import { OutletFormDialog } from './OutletFormDialog'
import { fieldValue, OUTLET_STATUS, STATUSES, useOutlet, useOutletForm, type Outlet, type OutletPage } from './outlets'

export function OutletStatusPill({ status, className }: { status: OutletStatus; className?: string }) {
  const meta = OUTLET_STATUS[status]
  return <StatusPill tone={meta.tone} icon={meta.icon} label={meta.label} className={className} />
}

/**
 * Fiche d'un point de vente : informations, champs de la structure, statut (avec commentaire)
 * et son historique. Responsables : modifier, déplacer ; administrateur : fusionner, supprimer.
 */
export function OutletSheet({
  id,
  onOpenChange,
  onMove,
  onSelect,
}: {
  id: string | null
  onOpenChange: (open: boolean) => void
  /** Choisir une nouvelle position sur la carte (page des points de vente) */
  onMove?: (outlet: Outlet) => void
  /** Ouvrir une autre fiche (après fusion) */
  onSelect: (id: string) => void
}) {
  const { user } = useMe()
  const isAdmin = user.role === Role.Admin
  const query = useOutlet(id)
  const form = useOutletForm()
  const outlet = query.data
  const [editing, setEditing] = useState(false)
  const [merging, setMerging] = useState(false)
  const [removing, setRemoving] = useState(false)

  return (
    <>
      <Sheet open={!!id} onOpenChange={onOpenChange}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle className="pr-8">{outlet?.name ?? 'Point de vente'}</SheetTitle>
            <SheetDescription>
              {outlet ? [outlet.category, outlet.zone ? `Zone ${outlet.zone.name}` : 'Hors zone'].filter(Boolean).join(' · ') : ' '}
            </SheetDescription>
          </SheetHeader>
          <QueryState query={query}>
            {outlet && (
              <div className="flex flex-col gap-5 p-4">
                <div className="flex items-start gap-3">
                  {outlet.photoId ? <Photo id={outlet.photoId} name={outlet.name} /> : null}
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <OutletStatusPill status={outlet.status} />
                      <span className="text-xs text-muted-foreground">depuis {formatRelative(outlet.statusChangedAt)}</span>
                    </div>
                    {outlet.lat == null && (
                      <p className="flex items-center gap-1.5 text-xs text-status-paused">
                        <MapPin className="size-3.5" aria-hidden /> À localiser : le premier agent sur place enregistre sa position.
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label="Actions" />}>
                      <MoreHorizontal aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(true)}>
                        <PenLine aria-hidden /> Modifier
                      </DropdownMenuItem>
                      {onMove && (
                        <DropdownMenuItem onClick={() => onMove(outlet)}>
                          <Move aria-hidden /> {outlet.lat == null ? 'Placer sur la carte' : 'Déplacer sur la carte'}
                        </DropdownMenuItem>
                      )}
                      {isAdmin && (
                        <>
                          <DropdownMenuItem onClick={() => setMerging(true)}>
                            <Combine aria-hidden /> Fusionner avec un doublon…
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setRemoving(true)}>
                            <Trash2 aria-hidden /> Supprimer…
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  {outlet.managerName && (
                    <>
                      <dt className="flex items-center gap-1.5 text-muted-foreground">
                        <UserRound className="size-3.5" aria-hidden /> Gérant
                      </dt>
                      <dd>{outlet.managerName}</dd>
                    </>
                  )}
                  {outlet.phone && (
                    <>
                      <dt className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="size-3.5" aria-hidden /> Téléphone
                      </dt>
                      <dd>
                        <a className="underline-offset-2 hover:underline" href={`tel:${outlet.phone}`}>
                          {formatPhone(outlet.phone)}
                        </a>
                      </dd>
                    </>
                  )}
                  {outlet.landmark && (
                    <>
                      <dt className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="size-3.5" aria-hidden /> Repère
                      </dt>
                      <dd>{outlet.landmark}</dd>
                    </>
                  )}
                  {form.data?.fields
                    .filter((f) => f.type !== 'photo')
                    .map((f) => (
                      <FieldRow key={f.key} label={f.label} value={fieldValue(f, outlet.data[f.key])} />
                    ))}
                  <dt className="text-muted-foreground">Ajouté</dt>
                  <dd>
                    {formatDateTime(outlet.createdAt)}
                    {outlet.createdBy && ` par ${outlet.createdBy.name}`}
                  </dd>
                </dl>
                {form.data?.fields
                  .filter((f) => f.type === 'photo' && typeof outlet.data[f.key] === 'string')
                  .map((f) => (
                    <div key={f.key} className="flex flex-col gap-1.5">
                      <p className="text-xs text-muted-foreground">{f.label}</p>
                      <Photo id={outlet.data[f.key] as string} name={f.label} />
                    </div>
                  ))}

                <StatusForm outlet={outlet} />

                {outlet.visits.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium">Visites</h3>
                    <ul className="flex flex-col divide-y rounded-lg border">
                      {outlet.visits.map((v) => (
                        <li key={v.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                          <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <Link to={`/missions/${v.missionId}`} className="block truncate font-medium hover:underline">
                              {v.missionTitle}
                            </Link>
                            <span className="block text-xs text-muted-foreground">
                              {[formatDateTime(v.submittedAt), v.agent, v.distance != null ? `à ${v.distance} m` : null]
                                .filter(Boolean)
                                .join(' · ')}
                              {v.status === 'rejected' && ' · rejetée'}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Historique</h3>
                  <ol className="flex flex-col gap-3 border-l pl-4">
                    {outlet.history.map((h) => (
                      <li key={h.id} className="relative text-sm">
                        <span
                          className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full"
                          style={{ background: OUTLET_STATUS[h.toStatus].color }}
                          aria-hidden
                        />
                        <p className="flex flex-wrap items-center gap-1">
                          {h.fromStatus === null ? (
                            <>Ajouté · {OUTLET_STATUS[h.toStatus].label}</>
                          ) : h.fromStatus === h.toStatus ? (
                            <>Note</>
                          ) : (
                            <>
                              {OUTLET_STATUS[h.fromStatus].label} <ArrowRight className="size-3.5" aria-label="devient" />{' '}
                              <span className="font-medium">{OUTLET_STATUS[h.toStatus].label}</span>
                            </>
                          )}
                        </p>
                        {h.comment && <p className="text-muted-foreground">« {h.comment} »</p>}
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(h.createdAt)}
                          {h.user && ` · ${h.user.name}`}
                        </p>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            )}
          </QueryState>
        </SheetContent>
      </Sheet>
      {outlet && (
        <>
          <OutletFormDialog open={editing} onOpenChange={setEditing} outlet={outlet} />
          <MergeDialog
            open={merging}
            onOpenChange={setMerging}
            outlet={outlet}
            onMerged={(into) => {
              setMerging(false)
              onSelect(into)
            }}
          />
          <RemoveOutletDialog open={removing} onOpenChange={setRemoving} outlet={outlet} onRemoved={() => onOpenChange(false)} />
        </>
      )}
    </>
  )
}

function FieldRow({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn(!value && 'text-muted-foreground')}>{value ?? '—'}</dd>
    </>
  )
}

function Photo({ id, name }: { id: string; name: string }) {
  const { url, isError } = usePhotoUrl(id)
  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="block size-20 shrink-0 overflow-hidden rounded-md border bg-muted"
      aria-label={`Photo : ${name}`}
    >
      {isError ? (
        <ImageOff className="m-auto mt-7 size-5 text-muted-foreground" aria-hidden />
      ) : url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <Skeleton className="size-full" />
      )}
    </a>
  )
}

/** Changement de statut, avec un commentaire facultatif (un commentaire seul est aussi noté). */
function StatusForm({ outlet }: { outlet: Outlet }) {
  const [status, setStatus] = useState<OutletStatus>(outlet.status)
  const [comment, setComment] = useState('')
  useEffect(() => setStatus(outlet.status), [outlet.status])
  const save = useApiMutation(() => api.post(`/outlets/${outlet.id}/status`, { status, comment: comment.trim() || undefined }), {
    success: status === outlet.status ? 'Commentaire ajouté' : `Statut : ${OUTLET_STATUS[status].label}`,
    invalidate: [['outlets']],
    onSuccess: () => setComment(''),
  })
  const changed = status !== outlet.status || !!comment.trim()

  return (
    <section className="flex flex-col gap-2 rounded-lg border p-3">
      <h3 className="text-sm font-medium">Changer le statut</h3>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Statut">
        {STATUSES.map((s) => {
          const meta = OUTLET_STATUS[s]
          const selected = status === s
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setStatus(s)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:bg-muted',
                selected && 'border-transparent text-white hover:opacity-90',
              )}
              style={selected ? { background: meta.color } : undefined}
            >
              <meta.icon className="size-3.5" aria-hidden />
              {meta.label}
            </button>
          )
        })}
      </div>
      <Textarea
        rows={2}
        placeholder="Commentaire (facultatif) : première commande passée, fermé pour travaux…"
        aria-label="Commentaire"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <Button size="sm" className="self-end" disabled={!changed || save.isPending} onClick={() => save.mutate(undefined)}>
        {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
        Enregistrer
      </Button>
    </section>
  )
}

/** Fusion d'un doublon : on choisit la fiche conservée, qui reprend l'historique. */
function MergeDialog({
  open,
  onOpenChange,
  outlet,
  onMerged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  outlet: Outlet
  onMerged: (intoId: string) => void
}) {
  const [q, setQ] = useState('')
  const [target, setTarget] = useState<Outlet | null>(null)
  useEffect(() => {
    if (open) {
      setQ(outlet.name)
      setTarget(null)
    }
  }, [open, outlet])
  const near = outlet.lat != null ? { lat: outlet.lat, lng: outlet.lng, radius: 2000 } : {}
  const results = useQuery({
    queryKey: ['outlets', 'merge', outlet.id, q],
    enabled: open,
    queryFn: async () => (await api.get<OutletPage>('/outlets', { params: { q: q.trim() || undefined, limit: 8, ...near } })).data,
  })
  const merge = useApiMutation(() => api.post(`/outlets/${outlet.id}/merge`, { intoId: target!.id }), {
    success: 'Fiches fusionnées',
    invalidate: [['outlets']],
    onSuccess: () => onMerged(target!.id),
  })
  const candidates = (results.data?.items ?? []).filter((o) => o.id !== outlet.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fusionner « {outlet.name} »</DialogTitle>
          <DialogDescription>
            Choisissez la fiche à conserver : elle reprend l’historique, les photos et les informations qui lui manquent. « {outlet.name} »
            est ensuite supprimée.
          </DialogDescription>
        </DialogHeader>
        <SearchInput value={q} onChange={setQ} placeholder="Nom, gérant, téléphone" label="Rechercher la fiche à conserver" />
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {candidates.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => setTarget(o)}
                aria-pressed={target?.id === o.id}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted',
                  target?.id === o.id && 'border-primary bg-primary/5 ring-1 ring-primary',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{o.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[o.category, o.zone?.name, o.distance != null ? `à ${o.distance} m` : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <OutletStatusPill status={o.status} />
              </button>
            </li>
          ))}
          {results.isSuccess && candidates.length === 0 && (
            <li className="p-4 text-center text-sm text-muted-foreground">Aucune autre fiche ne correspond.</li>
          )}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={!target || merge.isPending} onClick={() => merge.mutate(undefined)}>
            {merge.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Fusionner dans « {target?.name ?? '…'} »
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RemoveOutletDialog({
  open,
  onOpenChange,
  outlet,
  onRemoved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  outlet: Outlet
  onRemoved: () => void
}) {
  const remove = useApiMutation(() => api.delete(`/outlets/${outlet.id}`), {
    success: 'Point de vente supprimé',
    invalidate: [['outlets']],
    onSuccess: () => {
      onOpenChange(false)
      onRemoved()
    },
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer « {outlet.name} » ?</DialogTitle>
          <DialogDescription>
            La fiche, son historique et ses photos sont supprimés définitivement. Pour un commerce qui a cessé son activité, préférez le
            statut « Fermé ».
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(undefined)}>
            {remove.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Supprimer définitivement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
