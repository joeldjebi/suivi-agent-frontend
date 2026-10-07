import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'

/**
 * Ouverture directe d'un formulaire depuis un lien (ex. bouton de la documentation
 * « /users?new=agent ») : appelle `onOpen` avec la valeur du paramètre, puis le retire de
 * l'adresse pour qu'un rechargement ne rouvre pas le formulaire.
 */
export function useOpenFromQuery(onOpen: (value: string) => void, param = 'new') {
  const [params, setParams] = useSearchParams()
  const value = params.get(param)
  const open = useRef(onOpen)
  useEffect(() => {
    open.current = onOpen
  })
  useEffect(() => {
    if (!value) return
    open.current(value)
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete(param)
        return next
      },
      { replace: true },
    )
  }, [value, param, setParams])
}
