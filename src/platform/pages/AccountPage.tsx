import { Page, PageHeader } from '@/components/app/page'
import { formatDateTime, fullName } from '@/lib/format'
import { usePlatformAdmin } from '../auth'
import { MfaCard } from '../mfa'

export function AccountPage() {
  const admin = usePlatformAdmin()
  return (
    <Page>
      <PageHeader title="Sécurité du compte" description={`${fullName(admin)} · ${admin.email}`} />
      <div className="flex max-w-3xl flex-col gap-4">
        <MfaCard />
        <section className="rounded-lg border bg-card p-4 text-sm">
          <p className="font-medium">Sessions</p>
          <p className="mt-1 text-muted-foreground">
            Dernière connexion : {formatDateTime(admin.lastLoginAt)}. Une session reste dans cet onglet et se ferme après 30 minutes
            d’inactivité. Changer de mot de passe ferme toutes vos autres sessions.
          </p>
        </section>
      </div>
    </Page>
  )
}
