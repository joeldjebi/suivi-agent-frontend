import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { Tokens } from './types'

const REFRESH_KEY = 'suivi.refreshToken'

let accessToken: string | null = null
let onSessionExpired: (() => void) | null = null

export const api = axios.create({ baseURL: '/api' })

export const session = {
  get accessToken() {
    return accessToken
  },
  get refreshToken() {
    try {
      return localStorage.getItem(REFRESH_KEY)
    } catch {
      return null
    }
  },
  store(tokens: Tokens) {
    accessToken = tokens.accessToken
    try {
      localStorage.setItem(REFRESH_KEY, tokens.refreshToken)
    } catch {
      // Navigation privée : la session ne survivra pas au rechargement.
    }
  },
  clear() {
    accessToken = null
    try {
      localStorage.removeItem(REFRESH_KEY)
    } catch {
      // ignoré
    }
  },
  onExpired(callback: () => void) {
    onSessionExpired = callback
  },
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

let refreshing: Promise<boolean> | null = null

/**
 * Renouvelle la session avec ce jeton. Refusé alors qu'un autre onglet vient de la
 * renouveler (jeton différent dans le stockage) : nouvel essai avec le sien, sans déconnecter.
 */
function refreshWith(refreshToken: string, retries = 1): Promise<boolean> {
  return axios
    .post<Tokens>('/api/auth/refresh', { refreshToken })
    .then((res) => {
      session.store(res.data)
      return true
    })
    .catch(() => {
      const latest = session.refreshToken
      if (latest && latest !== refreshToken && retries > 0) return refreshWith(latest, retries - 1)
      session.clear()
      return false
    })
}

/** Renouvelle le jeton d'accès ; un seul appel à la fois. */
export function refreshSession(): Promise<boolean> {
  const refreshToken = session.refreshToken
  if (!refreshToken) return Promise.resolve(false)
  refreshing ??= refreshWith(refreshToken).finally(() => {
    refreshing = null
  })
  return refreshing
}

// Déconnexion dans un autre onglet (session retirée du stockage) : celui-ci se ferme aussi.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === REFRESH_KEY && event.newValue === null && accessToken) {
      accessToken = null
      onSessionExpired?.()
    }
  })
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
  // Connexion, renouvellement, déconnexion : un 401 ne se rattrape pas ; le reste de /auth
  // (profil, photo, mot de passe) renouvelle la session comme toute autre requête.
  if (error.response?.status !== 401 || !config || config._retried || /^\/auth\/(login|refresh|logout|register)/.test(config.url ?? '')) {
    throw error
  }
  config._retried = true
  if (await refreshSession()) return api(config)
  onSessionExpired?.()
  throw error
})

interface ApiErrorBody {
  code?: string
  message?: string | string[]
}

/** Code métier renvoyé par l'API (ZONE_FULL, DAY_STARTED…). */
export function errorCode(error: unknown): string | undefined {
  return (error as AxiosError<ApiErrorBody>)?.response?.data?.code
}

/** Message en français selon le statut, quand le serveur n'en donne pas de lisible. */
export function statusMessage(status: number): string {
  if (status === 400) return 'Certaines informations sont manquantes ou invalides.'
  if (status === 401) return 'Votre session a expiré. Reconnectez-vous.'
  if (status === 403) return 'Vous n’avez pas accès à cette action.'
  if (status === 404) return 'Élément introuvable.'
  if (status === 413) return 'Fichier ou envoi trop volumineux.'
  if (status === 429) return 'Trop de tentatives. Réessayez dans quelques instants.'
  if (status >= 500) return 'Le serveur a rencontré une erreur. Réessayez dans un instant.'
  return 'La demande n’a pas pu aboutir.'
}

/** Message de l'API à montrer tel quel : seulement s'il accompagne un code métier. */
export function readableMessage(status: number, body: unknown): string | undefined {
  const b = body as ApiErrorBody | undefined
  return status < 500 && typeof b?.code === 'string' && typeof b.message === 'string' ? b.message : undefined
}

/** Message lisible pour l'utilisateur. */
export function errorMessage(error: unknown): string {
  const axiosError = error as AxiosError<ApiErrorBody>
  if (!axiosError?.isAxiosError) return 'Une erreur inattendue est survenue.'
  if (!axiosError.response) {
    return axiosError.code === 'ECONNABORTED'
      ? 'Le serveur met trop de temps à répondre. Réessayez.'
      : 'Serveur injoignable. Vérifiez votre connexion.'
  }
  const { status, data } = axiosError.response
  return readableMessage(status, data) ?? statusMessage(status)
}
