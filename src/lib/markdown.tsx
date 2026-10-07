import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from './utils'

/**
 * Rendu Markdown minimal et sûr pour la documentation : titres (##, ###), paragraphes,
 * listes (-, 1.), citations (>), **gras**, *italique* et liens [texte](https://…).
 * Un lien vers un écran de l'application, [Créer une zone](/zones?new=1), devient un bouton.
 * Le HTML n'est jamais interprété : tout passe par React, qui échappe le texte.
 */
export function Markdown({
  source,
  className,
  internalLinks = true,
}: {
  source: string
  className?: string
  /** false (console éditeur) : boutons affichés sans navigation */
  internalLinks?: boolean
}) {
  const inline = (text: string) => inlineNodes(text, internalLinks)
  const blocks: ReactNode[] = []
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const heading = /^(#{2,3})\s+(.*)$/.exec(line)
    if (heading) {
      const Tag = heading[1].length === 2 ? 'h2' : 'h3'
      blocks.push(
        <Tag key={key++} className={Tag === 'h2' ? 'mt-6 text-lg font-semibold first:mt-0' : 'mt-4 text-base font-semibold'}>
          {inline(heading[2])}
        </Tag>,
      )
      i++
      continue
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''))
      blocks.push(
        <blockquote key={key++} className="rounded-md border-l-4 border-primary/40 bg-primary/5 px-4 py-2 text-sm">
          {inline(quote.join(' '))}
        </blockquote>,
      )
      continue
    }
    const ordered = /^\d+\.\s+/.test(line)
    if (ordered || /^[-*]\s+/.test(line)) {
      const items: string[] = []
      const pattern = ordered ? /^\d+\.\s+/ : /^[-*]\s+/
      while (i < lines.length && pattern.test(lines[i])) items.push(lines[i++].replace(pattern, ''))
      const List = ordered ? 'ol' : 'ul'
      blocks.push(
        <List key={key++} className={cn('flex flex-col gap-1.5 pl-5 text-sm leading-relaxed', ordered ? 'list-decimal' : 'list-disc')}>
          {items.map((item, j) => (
            <li key={j}>{inline(item)}</li>
          ))}
        </List>,
      )
      continue
    }
    const paragraph: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|>|\d+\.\s|[-*]\s)/.test(lines[i])) paragraph.push(lines[i++])
    blocks.push(
      <p key={key++} className="text-sm leading-relaxed">
        {inline(paragraph.join(' '))}
      </p>,
    )
  }
  return <div className={cn('flex flex-col gap-3', className)}>{blocks}</div>
}

const buttonClass =
  'mr-1.5 mb-1 inline-flex h-7 items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 text-xs font-medium text-primary no-underline transition-colors hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'

/** Gras, italique, liens externes et boutons vers les écrans de l'application. */
function inlineNodes(text: string, internalLinks: boolean): ReactNode[] {
  const out: ReactNode[] = []
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\[([^\]]+)\]\((\/[A-Za-z0-9/_\-?=&]*)\)/g
  let last = 0
  let k = 0
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) out.push(<strong key={k++}>{m[1]}</strong>)
    else if (m[2]) out.push(<em key={k++}>{m[2]}</em>)
    else if (m[5])
      out.push(
        internalLinks ? (
          <Link key={k++} to={m[6]} className={buttonClass}>
            {m[5]} <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        ) : (
          <span key={k++} className={buttonClass} title={`Ouvre ${m[6]} dans l’espace de la structure`}>
            {m[5]} <ArrowRight className="size-3.5" aria-hidden />
          </span>
        ),
      )
    else
      out.push(
        <a key={k++} href={m[4]} target="_blank" rel="noreferrer noopener" className="text-primary underline underline-offset-2">
          {m[3]}
        </a>,
      )
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
