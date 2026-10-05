import { Role, SubscriptionStatus } from '@suivi/shared'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useMe } from '@/lib/auth'
import { cn } from '@/lib/utils'

/** Rappel discret : essai en cours, ou paiement en retard. */
export function SubscriptionBanner() {
  const { user, subscription } = useMe()
  // Heure lue une fois par affichage : le décompte se met à jour au rechargement.
  const [now] = useState(Date.now)
  const admin = user.role === Role.Admin
  if (subscription.status === SubscriptionStatus.Trialing && subscription.trialEndsAt) {
    const days = Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - now) / 86400_000))
    return (
      <Bar tone="info" icon={<Sparkles className="size-4" aria-hidden />}>
        Essai gratuit : {days} jour{days > 1 ? 's' : ''} restant{days > 1 ? 's' : ''}.
        {admin && (
          <Link to="/subscription" className="ml-2 font-medium underline underline-offset-2">
            Choisir une formule
          </Link>
        )}
      </Bar>
    )
  }
  if (subscription.status === SubscriptionStatus.PastDue) {
    return (
      <Bar tone="warning" icon={<AlertTriangle className="size-4" aria-hidden />}>
        Une facture est en retard de paiement : l’accès sera suspendu sans règlement.
        {admin && (
          <Link to="/subscription" className="ml-2 font-medium underline underline-offset-2">
            Voir les factures
          </Link>
        )}
      </Bar>
    )
  }
  return null
}

function Bar({ tone, icon, children }: { tone: 'info' | 'warning'; icon: ReactNode; children: ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center justify-center gap-2 px-4 py-2 text-center text-sm',
        tone === 'info' ? 'bg-primary/10 text-primary' : 'bg-status-paused/10 text-status-paused',
      )}
    >
      {icon}
      <span>{children}</span>
    </div>
  )
}
