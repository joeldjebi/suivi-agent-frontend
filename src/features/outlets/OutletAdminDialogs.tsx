import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FieldsEditor, fieldsError, fromDrafts, toDrafts, type DraftField } from '@/components/app/fields-editor'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { ImportDialog } from '@/components/app/import-dialog'
import { useApiMutation } from '@/lib/queries'
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
