import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, refreshSession, session } from './api'
import type { Me, Tokens } from './types'

interface AuthState {
  me: Me | null
  loading: boolean
  login(identifier: string, password: string): Promise<void>
  register(input: RegisterInput): Promise<void>
  logout(): Promise<void>
  reload(): Promise<void>
}

export interface RegisterInput {
  organizationName: string
  firstName: string
  lastName: string
  email: string
  password: string
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const { data } = await api.get<Me>('/auth/me')
    setMe(data)
  }, [])

  const reset = useCallback(() => {
    session.clear()
    setMe(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    session.onExpired(reset)
    // Reprise de session au chargement grâce au jeton de rafraîchissement.
    refreshSession()
      .then((ok) => (ok ? reload() : undefined))
      .catch(reset)
      .finally(() => setLoading(false))
  }, [reload, reset])

  const value = useMemo<AuthState>(
    () => ({
      me,
      loading,
      reload,
      async login(identifier, password) {
        // Email (administrateurs) ou numéro de téléphone (chefs d'équipe).
        const credentials = identifier.includes('@') ? { email: identifier.trim() } : { phone: identifier.trim() }
        const { data } = await api.post<Tokens>('/auth/login', { ...credentials, password })
        session.store(data)
        await reload()
      },
      async register(input) {
        const { data } = await api.post<Tokens>('/auth/register', input)
        session.store(data)
        await reload()
      },
      async logout() {
        const refreshToken = session.refreshToken
        if (refreshToken) await api.post('/auth/logout', { refreshToken }).catch(() => undefined)
        reset()
      },
    }),
    [me, loading, reload, reset],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return context
}

/** Utilisateur connecté (à utiliser sous une route protégée). */
export function useMe(): Me {
  const { me } = useAuth()
  if (!me) throw new Error('Aucun utilisateur connecté')
  return me
}
