import { useState } from 'react'

/**
 * État mémorisé dans le navigateur (préférence d'affichage). Le stockage peut être
 * indisponible (navigation privée) : on retombe alors sur la valeur par défaut.
 */
export function usePersistentState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })
  const update = (next: T) => {
    setValue(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // préférence non mémorisée
    }
  }
  return [value, update]
}
