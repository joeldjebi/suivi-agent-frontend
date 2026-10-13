import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { FieldsEditor, fieldsError, fromDrafts, toDrafts, type DraftField } from '@/components/app/fields-editor'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api, errorMessage } from '@/lib/api'
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

interface ImportResult {
  created: number
  skippedCount: number
  skipped: { row: number; name: string | null; reason: string }[]
}

/** Import d'une liste Excel ou CSV, à partir du modèle (champs de la fiche compris). */
export function OutletImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [downloading, setDownloading] = useState(false)
  useEffect(() => {
    if (open) {
      setFile(null)
      setResult(null)
    }
  }, [open])

  const send = useApiMutation(
    async () => {
      const body = new FormData()
      body.append('file', file!)
      return (await api.post<ImportResult>('/outlets/import', body)).data
    },
    { invalidate: [['outlets']], onSuccess: setResult },
  )

  const template = async () => {
    setDownloading(true)
    try {
      const res = await api.get<Blob>('/outlets/import/template', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'modele-points-de-vente.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer des points de vente</DialogTitle>
          <DialogDescription>
            Une ligne par point de vente. La position (latitude, longitude) est facultative : sans elle, le point de vente est « à localiser
            » et le premier agent sur place l’enregistre.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 rounded-lg border border-status-active/30 bg-status-active/5 p-3 text-sm">
              <CheckCircle2 className="size-5 shrink-0 text-status-active" aria-hidden />
              <span>
                <strong>{result.created}</strong> point{result.created > 1 ? 's' : ''} de vente ajouté{result.created > 1 ? 's' : ''}
                {result.skippedCount > 0 &&
                  `, ${result.skippedCount} ligne${result.skippedCount > 1 ? 's' : ''} écartée${result.skippedCount > 1 ? 's' : ''}`}
                .
              </span>
            </p>
            {result.skipped.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Ligne</th>
                      <th className="px-3 py-2 font-medium">Nom</th>
                      <th className="px-3 py-2 font-medium">Motif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.skipped.map((s) => (
                      <tr key={`${s.row}-${s.reason}`}>
                        <td className="px-3 py-1.5 tabular-nums">{s.row}</td>
                        <td className="px-3 py-1.5">{s.name ?? '—'}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{s.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Button variant="outline" className="self-start" onClick={template} disabled={downloading}>
              {downloading ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
              Télécharger le modèle Excel
            </Button>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <FileSpreadsheet className="size-8 text-muted-foreground" aria-hidden />
              {file ? <span className="font-medium">{file.name}</span> : <span>Choisir un fichier Excel (.xlsx) ou CSV</span>}
              <span className="text-xs text-muted-foreground">
                Colonnes reconnues : Nom, Type, Gérant, Téléphone, Repère, Latitude, Longitude, Statut et les champs de la fiche.
              </span>
            </button>
            <input
              ref={input}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        )}
        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)}>Fermer</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button disabled={!file || send.isPending} onClick={() => send.mutate(undefined)}>
                {send.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
                Importer
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
