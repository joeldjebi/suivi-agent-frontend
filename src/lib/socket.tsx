import { SocketEvent } from '@suivi/shared'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { refreshSession, session } from './api'
import { queryRootsFor } from './sync-topics'
import type { Notification } from './types'

const SocketContext = createContext<Socket | null>(null)

/**
 * Adresse du serveur temps réel. En production : même origine que le site (Nginx).
 * En développement : l'API directement, sur le port 3000 de la même machine.
 */
const SOCKET_URL: string | undefined =
  import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? `${location.protocol}//${location.hostname}:3000` : undefined)

/** Connexion temps réel, active tant qu'un utilisateur est connecté. */
export function SocketProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  // Créée une seule fois ; la connexion suit la vie du composant.
  const [socket] = useState<Socket>(() =>
    io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      autoConnect: false,
      auth: (cb) => cb({ token: session.accessToken }),
    }),
  )

  useEffect(() => {
    // Le serveur ferme la connexion si le jeton a expiré : on le renouvelle puis on se reconnecte.
    const onDisconnect = (reason: string) => {
      if (reason === 'io server disconnect') {
        void refreshSession().then((ok) => ok && socket.connect())
      }
    }
    const onNotification = (notification: Notification) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.info(notification.title, { description: notification.body ?? undefined })
    }
    const onZoneRequest = () => {
      void queryClient.invalidateQueries({ queryKey: ['zone-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['zones'] })
    }
    // Alerte ouverte, refermée ou prise en charge : centre d'alertes et carte à jour.
    const onAlert = () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] })
      void queryClient.invalidateQueries({ queryKey: ['live'] })
    }
    // « Ces données ont changé » (geste d'un agent, d'un chef, d'une tâche automatique) : les
    // pages affichées se relisent. Les annonces rapprochées sont regroupées (une demi-seconde).
    const pending = new Set<string>()
    let timer: ReturnType<typeof setTimeout> | undefined
    const onSync = ({ topic }: { topic: string }) => {
      for (const root of queryRootsFor(topic)) pending.add(root)
      clearTimeout(timer)
      timer = setTimeout(() => {
        const roots = [...pending]
        pending.clear()
        for (const root of roots) void queryClient.invalidateQueries({ queryKey: [root] })
      }, 500)
    }
    // Reconnexion (veille, réseau coupé) : des annonces ont pu être manquées, tout se relit.
    let connectedOnce = false
    const onConnect = () => {
      if (connectedOnce) void queryClient.invalidateQueries()
      connectedOnce = true
    }
    socket.on('connect', onConnect)
    socket.on('sync', onSync)
    socket.on('disconnect', onDisconnect)
    socket.on(SocketEvent.AgentAlert, onAlert)
    socket.on(SocketEvent.Notification, onNotification)
    socket.on(SocketEvent.ZoneRequestCreated, onZoneRequest)
    socket.connect()
    return () => {
      // Seuls les écouteurs du fournisseur : ceux des pages sont gérés par useSocketEvent.
      clearTimeout(timer)
      socket.off('connect', onConnect)
      socket.off('sync', onSync)
      socket.off('disconnect', onDisconnect)
      socket.off(SocketEvent.Notification, onNotification)
      socket.off(SocketEvent.ZoneRequestCreated, onZoneRequest)
      socket.off(SocketEvent.AgentAlert, onAlert)
      socket.disconnect()
    }
  }, [socket, queryClient])

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
}

/** Abonnement à un événement temps réel pendant la vie du composant. */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
  const socket = useContext(SocketContext)
  useEffect(() => {
    if (!socket) return
    socket.on(event, handler)
    return () => {
      socket.off(event, handler)
    }
  }, [socket, event, handler])
}

export function useSocketConnected(): boolean {
  const socket = useContext(SocketContext)
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!socket) return () => undefined
      socket.on('connect', notify)
      socket.on('disconnect', notify)
      return () => {
        socket.off('connect', notify)
        socket.off('disconnect', notify)
      }
    },
    [socket],
  )
  return useSyncExternalStore(subscribe, () => socket?.connected ?? false)
}
