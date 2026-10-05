import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { AuthLayout } from './AuthLayout'

const schema = z.object({
  organizationName: z.string().trim().min(2, 'Nom de la structure requis'),
  firstName: z.string().trim().min(1, 'Prénom requis'),
  lastName: z.string().trim().min(1, 'Nom requis'),
  email: z.email('Adresse email invalide'),
  password: z.string().min(8, 'Au moins 8 caractères'),
})
type Values = z.infer<typeof schema>

export function RegisterPage() {
  const { register: signUp } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { organizationName: '', firstName: '', lastName: '', email: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      // PublicOnly ouvre ensuite les paramètres de la nouvelle structure.
      await signUp(values)
    } catch (e) {
      setError(errorMessage(e))
    }
  })

  const field = (name: keyof Values, label: string, props: React.ComponentProps<'input'> = {}) => (
    <Field data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input id={name} aria-invalid={!!errors[name]} {...props} {...form.register(name)} />
      <FieldError errors={[errors[name]]} />
    </Field>
  )

  return (
    <AuthLayout
      title="Créer l'espace de votre structure"
      description="Vous en serez l'administrateur"
      footer={
        <>
          Déjà inscrit ?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {field('organizationName', 'Nom de la structure', { autoFocus: true, autoComplete: 'organization' })}
          <div className="grid grid-cols-2 gap-3">
            {field('firstName', 'Prénom', { autoComplete: 'given-name' })}
            {field('lastName', 'Nom', { autoComplete: 'family-name' })}
          </div>
          {field('email', 'Email professionnel', { type: 'email', autoComplete: 'email' })}
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...form.register('password')}
            />
            <FieldDescription>8 caractères minimum.</FieldDescription>
            <FieldError errors={[errors.password]} />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            Créer mon espace
          </Button>
        </FieldGroup>
      </form>
    </AuthLayout>
  )
}
