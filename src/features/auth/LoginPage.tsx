import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { AuthLayout } from './AuthLayout'

const schema = z.object({
  email: z
    .string()
    .trim()
    .refine(
      (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || /^\+?[\d\s.\-()]{8,20}$/.test(v),
      'Saisissez un email ou un numéro de téléphone',
    ),
  password: z.string().min(1, 'Mot de passe requis'),
})
type Values = z.infer<typeof schema>

export function LoginPage() {
  const { login } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setError(null)
    try {
      // La redirection est faite par PublicOnly dès que la session est ouverte.
      await login(email, password)
    } catch (e) {
      setError(errorMessage(e))
    }
  })

  return (
    <AuthLayout
      title="Connexion"
      description="Suivez vos agents terrain en temps réel"
      footer={
        <>
          Nouvelle structure ?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Créer un espace
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Email ou téléphone</FieldLabel>
            <Input
              id="email"
              type="text"
              inputMode="email"
              autoComplete="username"
              autoFocus
              aria-invalid={!!errors.email}
              {...form.register('email')}
            />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              {...form.register('password')}
            />
            <FieldError errors={[errors.password]} />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            Se connecter
          </Button>
        </FieldGroup>
      </form>
    </AuthLayout>
  )
}
