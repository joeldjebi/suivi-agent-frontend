import { useQuery } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { api } from '@/lib/api'
import { formatRelative } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import type { Notification } from '@/lib/types'
import { cn } from '@/lib/utils'

export function NotificationsButton() {
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<Notification[]>('/notifications')).data,
    refetchInterval: 60_000,
  })
  const notifications = query.data ?? []
  const unread = notifications.filter((n) => !n.readAt).length

  const markRead = useApiMutation((id: string) => api.post(`/notifications/${id}/read`), {
    invalidate: [['notifications']],
  })
  const markAll = useApiMutation(() => api.post('/notifications/read-all'), { invalidate: [['notifications']] })

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${unread} non lues`} />
        }
      >
        <Bell aria-hidden />
        {/* Emplacement fixe : le badge ne décale pas la barre d'outils. */}
        <span
          aria-hidden
          className={cn(
            'absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white tabular-nums',
            unread === 0 && 'invisible',
          )}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          <Button variant="ghost" size="xs" disabled={unread === 0 || markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck aria-hidden /> Tout marquer comme lu
          </Button>
        </div>
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Aucune notification</p>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-muted',
                      !n.readAt && 'bg-primary/5',
                    )}
                    onClick={() => !n.readAt && markRead.mutate(n.id)}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {!n.readAt && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Non lue" />}
                      {n.title}
                    </span>
                    {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
                    <span className="text-xs text-muted-foreground">{formatRelative(n.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
