import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api, errorMessage } from '@/lib/api'
import { useApiMutation } from '@/lib/queries'

interface ImportResult {
  created: number
  skippedCount: number
  skipped: { row: number; name: string | null; reason: string }[]
}

/** Import d'une liste Excel ou CSV à partir d'un modèle : les lignes écartées sont listées avec leur motif. */
export function ImportDialog({
  open,
  onOpenChange,
  title,
  description,
  url,
  templateFilename,
  invalidate,
  noun,
  hint,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** Ex. /products/import (le modèle : …/template) */
  url: string
  templateFilename: string
  invalidate: string[][]
  /** « produit », « point de vente » : pour le compte rendu */
  noun: { one: string; many: string; added: string; addedMany: string }
  /** Colonnes reconnues */
  hint: string
}) {
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
      return (await api.post<ImportResult>(url, body)).data
    },
    { invalidate, onSuccess: setResult },
  )

  const template = async () => {
    setDownloading(true)
    try {
      const res = await api.get<Blob>(`${url}/template`, { responseType: 'blob' })
      const link = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = link
      a.download = templateFilename
      a.click()
      URL.revokeObjectURL(link)
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 rounded-lg border border-status-active/30 bg-status-active/5 p-3 text-sm">
              <CheckCircle2 className="size-5 shrink-0 text-status-active" aria-hidden />
              <span>
                <strong>{result.created}</strong> {result.created > 1 ? `${noun.many} ${noun.addedMany}` : `${noun.one} ${noun.added}`}
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
              <span className="text-xs text-muted-foreground">{hint}</span>
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
