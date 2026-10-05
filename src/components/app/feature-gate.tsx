import { Role, type Feature } from '@suivi/shared'
import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useMe } from '@/lib/auth'
import { featureLabel } from '@/lib/subscription'
import { Page } from './page'

/** Page réservée à une formule : sinon, explication et accès aux formules. */
export function FeatureGate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { user, subscription } = useMe()
  if (subscription.features.includes(feature)) return children
  const upgrade = subscription.upgrades?.[feature]
  return (
    <Page>
      <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-lg border bg-card px-6 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="size-5" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold">{featureLabel[feature]}</h1>
        <p className="text-sm text-muted-foreground">
          {upgrade ? (
            <>
              Cette fonctionnalité est incluse dans la formule <strong>{upgrade.name}</strong>.
            </>
          ) : (
            'Cette fonctionnalité n’est pas incluse dans votre formule.'
          )}{' '}
          Votre structure utilise la formule {subscription.planName}.
        </p>
        {user.role === Role.Admin ? (
          <Button nativeButton={false} render={<Link to="/subscription" />}>Voir les formules</Button>
        ) : (
          <p className="text-sm text-muted-foreground">Demandez à votre administrateur de changer de formule.</p>
        )}
      </div>
    </Page>
  )
}
