import { Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldsEditor, fieldsError, fromDrafts, toDrafts, type DraftField } from '@/components/app/fields-editor'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { ImportDialog } from '@/components/app/import-dialog'
import { useApiMutation, useMissionTypes } from '@/lib/queries'
import { useOutletForm } from './outlets'

/** Champs de la fiche des points de vente, propres à la structure. */
export function OutletFieldsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const form = useOutletForm()
  const [fields, setFields] = useState<DraftField[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open && form.data) {
      setFields(toDrafts(form.data.fields))
      setError(null)
    }
  }, [open, form.data])
  const save = useApiMutation(() => api.put('/outlets/form', { fields: fromDrafts(fields) }), {
    success: 'Fiche enregistrée',
    invalidate: [['outlets']],
    onSuccess: () => onOpenChange(false),
  })
  const submit = () => {
    const invalid = fieldsError(fields)
    if (invalid) return setError(invalid)
    setError(null)
    save.mutate(undefined)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fiche du point de vente</DialogTitle>
          <DialogDescription>
            Le nom, le type, le gérant, le téléphone, le repère, la photo et la position sont toujours demandés. Ajoutez ici ce que votre
            structure veut savoir en plus : surface, possède un frigo, jour de marché…
          </DialogDescription>
        </DialogHeader>
        <FieldsEditor
          title="Champs en plus"
          fields={fields}
          onChange={setFields}
          savedKeys={form.data?.fields.map((f) => f.key)}
          emptyText="Aucun champ en plus : la fiche se limite aux informations de base."
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={save.isPending || !form.data}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Import d'une liste Excel ou CSV, à partir du modèle (champs de la fiche compris). */
export function OutletImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <ImportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Importer des points de vente"
      description="Une ligne par point de vente. La position (latitude, longitude) est facultative : sans elle, le point de vente est « à localiser » et le premier agent sur place l’enregistre."
      url="/outlets/import"
      templateFilename="modele-points-de-vente.xlsx"
      invalidate={[['outlets']]}
      noun={{ one: 'point de vente', many: 'points de vente', added: 'ajouté', addedMany: 'ajoutés' }}
      hint="Colonnes reconnues : Nom, Type, Gérant, Téléphone, Repère, Latitude, Longitude, Statut et les champs de la fiche."
    />
  )
}

interface VisitForm {
  id: string
  name: string
}

/**
 * Formulaires proposés à l'agent pour visiter un point de vente sans mission (socle commun :
 * les mêmes formulaires que les missions).
 */
export function VisitFormsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const types = useMissionTypes()
  const current = useQuery({
    queryKey: ['outlets', 'visit-forms'],
    enabled: open,
    queryFn: async () => (await api.get<VisitForm[]>('/outlets/visit-forms')).data,
  })
  const [selected, setSelected] = useState<string[]>([])
  useEffect(() => {
    if (open && current.data) setSelected(current.data.map((f) => f.id))
  }, [open, current.data])
  const save = useApiMutation(() => api.put('/outlets/visit-forms', { typeIds: selected }), {
    success: 'Formulaires de visite enregistrés',
    invalidate: [['outlets', 'visit-forms']],
    onSuccess: () => onOpenChange(false),
  })
  const active = (types.data ?? []).filter((t) => t.isActive)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Formulaires de visite</DialogTitle>
          <DialogDescription>
            Les formulaires que l’agent peut remplir en visitant un point de vente, sans mission. Ce sont les mêmes que ceux des missions :
            créez-les ou modifiez-les dans Missions → Formulaires.
          </DialogDescription>
        </DialogHeader>
        {active.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Aucun formulaire.{' '}
            <Link to="/mission-types" className="font-medium text-primary underline-offset-2 hover:underline">
              Créer un formulaire
            </Link>
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {active.map((t) => (
              <li key={t.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted">
                  <Checkbox
                    checked={selected.includes(t.id)}
                    onCheckedChange={(c) => setSelected((l) => (c ? [...l, t.id] : l.filter((id) => id !== t.id)))}
                  />
                  <span className="flex-1">
                    <span className="block font-medium">{t.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t.fields.length} champ{t.fields.length > 1 ? 's' : ''}
                      {t.fields.some((f) => f.type === 'products') && ' · relevé par produit'}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {selected.length === 0 && active.length > 0 && (
          <p className="text-xs text-status-paused">
            Sans formulaire, les agents ne peuvent visiter un point de vente qu’à travers une mission.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => save.mutate(undefined)} disabled={save.isPending || !current.data}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
