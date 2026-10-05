/** Champ numérique facultatif : vide = élément non utilisé. */
export type Num = string
export const num = (v: Num): number | null => (v.trim() === '' ? null : Number(v.replace(',', '.')))
export const str = (v: number | null | undefined): Num => (v === null || v === undefined ? '' : String(v))
