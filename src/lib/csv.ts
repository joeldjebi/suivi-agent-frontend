/**
 * Texte qui commence par = + - @ (ou une tabulation) : Excel l'exécuterait comme une formule à
 * l'ouverture du CSV. Il est préfixé d'une apostrophe ; les nombres restent tels quels.
 */
export function csvSafe(value: string | number): string {
  const text = String(value)
  return typeof value === 'string' && /^[=+\-@\t\r]/.test(text) && !/^-?\d+([.,]\d+)?$/.test(text) ? `'${text}` : text
}

/** Cellule CSV (séparateur « ; ») : protégée des formules et entre guillemets. */
export function csvCell(value: string | number): string {
  return `"${csvSafe(value).replace(/"/g, '""')}"`
}
