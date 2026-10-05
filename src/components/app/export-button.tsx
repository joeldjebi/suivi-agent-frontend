import { Feature } from '@suivi/shared'
import { Download, FileSpreadsheet, FileText, Loader2, Lock } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api, errorMessage } from '@/lib/api'
import { useMe } from '@/lib/auth'

/** Nom de fichier proposé par le serveur (Content-Disposition). */
function filenameOf(header: string | undefined, fallback: string) {
  return /filename="([^"]+)"/.exec(header ?? '')?.[1] ?? fallback
}

/** Le corps d'une erreur reçue en Blob est du JSON : on en tire le message. */
async function blobError(error: unknown): Promise<string> {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (data instanceof Blob) {
    try {
      const body = JSON.parse(await data.text()) as { message?: string }
      if (typeof body.message === 'string') return body.message
    } catch {
      // Corps illisible : message générique ci-dessous.
    }
  }
  return errorMessage(error)
}

/**
 * Bouton « Exporter » : Excel (par défaut) ou CSV, avec les filtres de la page. Cadenas si la
 * formule n'inclut pas les exports.
 */
export function ExportButton({
  path,
  params,
  description,
  disabled,
  size = 'default',
}: {
  /** Ex. /exports/days */
  path: string
  params: Record<string, string | undefined>
  /** Ce qui sera exporté, affiché dans le menu (« Du 1er au 30 septembre ») */
  description?: string
  disabled?: boolean
  size?: 'default' | 'sm'
}) {
  const { subscription } = useMe()
  const [busy, setBusy] = useState<'xlsx' | 'csv' | null>(null)
  const allowed = subscription.features.includes(Feature.Exports)

  if (!allowed) {
    const plan = subscription.upgrades[Feature.Exports]?.name ?? 'supérieure'
    return (
      <Button
        variant="outline"
        size={size}
        nativeButton={false}
        render={<Link to="/subscription" />}
        title={`Exports inclus à partir de la formule ${plan}`}
      >
        <Lock aria-hidden /> Exporter
      </Button>
    )
  }

  const download = async (format: 'xlsx' | 'csv') => {
    setBusy(format)
    try {
      const res = await api.get<Blob>(path, { params: { ...params, format }, responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = filenameOf(res.headers['content-disposition'] as string | undefined, `export.${format}`)
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(await blobError(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size={size} disabled={disabled || !!busy} />}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />} Exporter
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {description && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{description}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => void download('xlsx')}>
          <FileSpreadsheet aria-hidden /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void download('csv')}>
          <FileText aria-hidden /> CSV (pour d’autres outils)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
