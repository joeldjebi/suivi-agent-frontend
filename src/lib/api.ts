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

/** Renouvelle le jeton d'accès ; un seul appel à la fois. */
export function refreshSession(): Promise<boolean> {
  const refreshToken = session.refreshToken
  if (!refreshToken) return Promise.resolve(false)
  refreshing ??= axios
    .post<Tokens>('/api/auth/refresh', { refreshToken })
    .then((res) => {
      session.store(res.data)
      return true
    })
    .catch(() => {
      session.clear()
      return false
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
  if (error.response?.status !== 401 || !config || config._retried || config.url?.startsWith('/auth/')) {
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

/** Message lisible pour l'utilisateur. */
export function errorMessage(error: unknown): string {
  const axiosError = error as AxiosError<ApiErrorBody>
  if (!axiosError?.isAxiosError) return 'Une erreur inattendue est survenue.'
  if (!axiosError.response) return 'Serveur injoignable. Vérifiez votre connexion.'
  const message = axiosError.response.data?.message
  if (axiosError.response.status === 400 && Array.isArray(message)) {
    return 'Certaines valeurs sont invalides. Vérifiez le formulaire.'
  }
  if (typeof message === 'string' && axiosError.response.status < 500) return message
  return 'Le serveur a rencontré une erreur. Réessayez dans un instant.'
}
