import { Role } from '@suivi/shared'
import { Ban } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useMe } from '@/lib/auth'
import { Page } from './page'

/** Abonnement suspendu : seul l'abonnement reste accessible à l'administrateur. */
export function SuspendedScreen() {
  const { user } = useMe()
  return (
    <Page>
      <div
        role="alert"
        className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-lg border bg-card px-6 py-10 text-center"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-status-alert/10 text-status-alert">
          <Ban className="size-5" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold">Abonnement suspendu</h1>
        <p className="text-sm text-muted-foreground">
          Une facture n’a pas été réglée à temps. Les agents et les chefs d’équipe n’ont plus accès à l’application jusqu’au paiement.
        </p>
        {user.role === Role.Admin ? (
          <Button nativeButton={false} render={<Link to="/subscription" />}>
            Voir les factures
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Contactez l’administrateur de votre structure.</p>
        )}
      </div>
    </Page>
  )
}
