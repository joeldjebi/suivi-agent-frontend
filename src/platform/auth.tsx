import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { platformApi, platformSession } from './api'
import type { MfaChallenge, PlatformAdmin, PlatformSession } from './types'

/** Sans activité pendant 30 minutes, la console se ferme d'elle-même. */
const IDLE_MS = 30 * 60_000

interface PlatformAuth {
  admin: PlatformAdmin | null
  loading: boolean
  /** Raison de la dernière fermeture de session (inactivité, expiration). */
  notice: string | null
  /** Mot de passe accepté, code de double authentification attendu */
  challenge: MfaChallenge | null
  login(email: string, password: string): Promise<void>
  verifyMfa(code: string): Promise<void>
  cancelMfa(): void
  logout(): Promise<void>
  changePassword(currentPassword: string, newPassword: string): Promise<void>
  /** Nouvelle session remise par l'API (activation ou désactivation de la 2FA) */
  adopt(session: PlatformSession): Promise<void>
}

const Context = createContext<PlatformAuth | null>(null)

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null)
  // Sans jeton dans l'onglet, rien à vérifier : écran de connexion directement.
  const [loading, setLoading] = useState(() => platformSession.get() !== null)
  const [notice, setNotice] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null)

  const end = useCallback(
    (reason: string | null) => {
      platformSession.clear()
      setAdmin(null)
      setNotice(reason)
      queryClient.removeQueries({ queryKey: ['platform'] })
    },
    [queryClient],
  )

  useEffect(() => {
    platformSession.onExpired(() => end('Votre session a expiré. Reconnectez-vous.'))
    if (!platformSession.get()) return
    platformApi
      .get<PlatformAdmin>('/auth/me')
      .then((res) => setAdmin(res.data))
      .catch(() => end(null))
      .finally(() => setLoading(false))
  }, [end])

  // Fermeture automatique : fin du jeton, ou inactivité prolongée.
  useEffect(() => {
    if (!admin) return
    const stored = platformSession.get()
    const expiry = stored ? setTimeout(() => end('Votre session a expiré. Reconnectez-vous.'), stored.expiresAt - Date.now()) : undefined
    let idle = setTimeout(() => end('Session fermée après 30 minutes d’inactivité.'), IDLE_MS)
    const touch = () => {
      clearTimeout(idle)
      idle = setTimeout(() => end('Session fermée après 30 minutes d’inactivité.'), IDLE_MS)
    }
    const events = ['pointerdown', 'keydown', 'scroll'] as const
    for (const e of events) window.addEventListener(e, touch, { passive: true })
    return () => {
      clearTimeout(expiry)
      clearTimeout(idle)
      for (const e of events) window.removeEventListener(e, touch)
    }
  }, [admin, end])

  /** Session ouverte : jeton conservé dans l'onglet, profil relu (état de la 2FA compris). */
  const open = useCallback(async (session: PlatformSession) => {
    platformSession.store(session.accessToken, session.expiresIn)
    setNotice(null)
    setChallenge(null)
    setAdmin((await platformApi.get<PlatformAdmin>('/auth/me')).data)
  }, [])

  const value = useMemo<PlatformAuth>(
    () => ({
      admin,
      loading,
      notice,
      challenge,
      async login(email, password) {
        const { data } = await platformApi.post<PlatformSession | MfaChallenge>('/auth/login', { email: email.trim(), password })
        if ('mfaRequired' in data) {
          setNotice(null)
          setChallenge(data)
          return
        }
        await open(data)
      },
      async verifyMfa(code) {
        if (!challenge) return
        const { data } = await platformApi.post<PlatformSession>('/auth/login/mfa', {
          mfaToken: challenge.mfaToken,
          code: code.trim(),
        })
        await open(data)
      },
      cancelMfa() {
        setChallenge(null)
      },
      adopt: open,
      async logout() {
        await platformApi.post('/auth/logout').catch(() => undefined)
        end(null)
      },
      async changePassword(currentPassword, newPassword) {
        const { data } = await platformApi.patch<PlatformSession>('/auth/password', { currentPassword, newPassword })
        platformSession.store(data.accessToken, data.expiresIn)
      },
    }),
    [admin, loading, notice, challenge, end, open],
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function usePlatformAuth(): PlatformAuth {
  const context = useContext(Context)
  if (!context) throw new Error('usePlatformAuth doit être utilisé dans PlatformAuthProvider')
  return context
}

export function usePlatformAdmin(): PlatformAdmin {
  const { admin } = usePlatformAuth()
  if (!admin) throw new Error('Aucun compte éditeur connecté')
  return admin
}
