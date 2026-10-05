import { Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { AuthLayout } from './AuthLayout'

/** Les agents utilisent l'app mobile ; la plateforme web est réservée à l'encadrement. */
export function AgentNotice() {
  const { logout } = useAuth()
  return (
    <AuthLayout
      title="Utilisez l'application mobile"
      description="La plateforme web est réservée aux administrateurs et chefs d'équipe."
      footer={null}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <Smartphone className="size-10 text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Choisissez votre zone, démarrez votre journée et réalisez vos missions depuis l'application Suivi Agent sur votre téléphone.
        </p>
        <Button variant="outline" className="w-full" onClick={() => void logout()}>
          Se déconnecter
        </Button>
      </div>
    </AuthLayout>
  )
}
