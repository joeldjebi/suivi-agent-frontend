import { TenantApprovalStatus } from '@suivi/shared'
import { Clock, LogOut, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth, useMe } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { LogoMark } from './logo'

/**
 * Structure pas encore validée (ou refusée) par l'éditeur : l'accès est bloqué, on affiche un
 * écran d'attente avec la possibilité de se déconnecter.
 */
export function PendingScreen() {
  const { subscription, tenant, user } = useMe()
  const { logout } = useAuth()
  const rejected = subscription.approvalStatus === TenantApprovalStatus.Rejected
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div
        role="alert"
        className="flex w-full max-w-md flex-col items-center gap-3 rounded-xl border bg-card px-6 py-10 text-center"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <LogoMark className="size-5" />
        </span>
        <span
          className={cn(
            'mt-2 flex size-12 items-center justify-center rounded-full',
            rejected ? 'bg-status-alert/10 text-status-alert' : 'bg-status-paused/10 text-status-paused',
          )}
        >
          {rejected ? <XCircle className="size-6" aria-hidden /> : <Clock className="size-6" aria-hidden />}
        </span>
        <h1 className="text-lg font-semibold">
          {rejected ? 'Inscription non retenue' : 'Compte en attente de validation'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {rejected
            ? `Votre inscription pour « ${tenant.name} » n’a pas été retenue.${
                tenant.rejectionReason ? ` Motif : ${tenant.rejectionReason}` : ''
              }`
            : `Votre inscription pour « ${tenant.name} » a bien été reçue. Notre équipe valide votre compte sous peu — vous pourrez accéder à l’application dès qu’il est activé.`}
        </p>
        <p className="text-xs text-muted-foreground">Connecté en tant que {user.email}</p>
        <Button variant="outline" className="mt-1" onClick={() => void logout()}>
          <LogOut aria-hidden /> Se déconnecter
        </Button>
      </div>
    </div>
  )
}
