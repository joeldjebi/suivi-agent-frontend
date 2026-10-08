/**
 * Symbole Suivi Agent (« le parcours ») : un trajet du départ à l'arrivée. Le trait prend la
 * couleur du texte (currentColor) ; `hole` colore l'intérieur des points, de la couleur du
 * fond sur lequel il est posé.
 */
export function LogoMark({ className, hole = 'var(--primary)' }: { className?: string; hole?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <path d="M16 52C16 40 48 43 48 32S16 23 16 12" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <circle cx="16" cy="52" r="6.5" fill={hole} stroke="currentColor" strokeWidth="4" />
      <circle cx="16" cy="12" r="8" fill="currentColor" />
      <circle cx="16" cy="12" r="3" fill={hole} />
    </svg>
  )
}
