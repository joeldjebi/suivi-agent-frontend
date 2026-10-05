import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** « 21–40 sur 134 » et boutons précédent / suivant. Masquée s'il n'y a qu'une page. */
export function Pagination({
  page,
  pages,
  total,
  pageSize,
  onPage,
}: {
  page: number
  pages: number
  total: number
  pageSize: number
  onPage: (page: number) => void
}) {
  if (pages <= 1) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <nav aria-label="Pagination" className="flex items-center justify-end gap-2 text-sm">
      <span className="text-muted-foreground tabular-nums">
        {from}–{to} sur {total}
      </span>
      <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Page précédente">
        <ChevronLeft aria-hidden />
      </Button>
      <span className="tabular-nums">
        {page} / {pages}
      </span>
      <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Page suivante">
        <ChevronRight aria-hidden />
      </Button>
    </nav>
  )
}
