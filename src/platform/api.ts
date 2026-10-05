import axios, { type AxiosError } from 'axios'

/**
 * Client de la console éditeur. Le jeton vit dans l'onglet seulement (sessionStorage) :
 * fermer l'onglet ferme la session ; aucun jeton de renouvellement.
 */
const TOKEN_KEY = 'suivi.platform.session'

interface Stored {
  token: string
  expiresAt: number
}

let onExpired: (() => void) | null = null
/** Repli quand le stockage de l'onglet est indisponible (navigation privée stricte). */
let memory: Stored | null = null

function read(): Stored | null {
  let stored = memory
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY)
    if (raw) stored = JSON.parse(raw) as Stored
  } catch {
    // stockage indisponible
  }
  return stored && stored.expiresAt > Date.now() ? stored : null
}

export const platformSession = {
  get(): Stored | null {
    return read()
  },
  store(token: string, expiresIn: number) {
    memory = { token, expiresAt: Date.now() + expiresIn * 1000 }
    try {
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify(memory))
    } catch {
      // Stockage indisponible : la session ne survivra pas au rechargement.
    }
  },
  clear() {
    memory = null
    try {
      sessionStorage.removeItem(TOKEN_KEY)
    } catch {
      // ignoré
    }
  },
  onExpired(callback: () => void) {
    onExpired = callback
  },
}

export const platformApi = axios.create({ baseURL: '/api/platform' })

platformApi.interceptors.request.use((config) => {
  const token = read()?.token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

platformApi.interceptors.response.use(undefined, (error: AxiosError) => {
  // Session expirée ou révoquée : retour à l'écran de connexion.
  if (error.response?.status === 401 && !error.config?.url?.startsWith('/auth/login')) onExpired?.()
  throw error
})
