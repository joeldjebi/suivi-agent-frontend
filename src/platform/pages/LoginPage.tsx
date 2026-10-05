import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/api'
import { usePlatformAuth } from '../auth'

const schema = z.object({
  email: z.string().trim().email('Saisissez votre email'),
  password: z.string().min(1, 'Mot de passe requis'),
})
type Values = z.infer<typeof schema>

/** Connexion à la console éditeur : sobre, sans lien vers l'espace des structures. */
export function PlatformLoginPage() {
  const { login, notice, challenge } = usePlatformAuth()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setError(null)
    try {
      await login(email, password)
    } catch (e) {
      setError(errorMessage(e))
      form.setValue('password', '')
    }
  })

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/15">
            <ShieldCheck className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-white">Console éditeur</h1>
            <p className="text-sm text-slate-400">Accès réservé à l’équipe Suivi Agent</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-card p-6 shadow-2xl">
          {challenge ? (
            <MfaStep />
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <FieldGroup>
                {notice && (
                  <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {notice}
                  </p>
                )}
                <Field data-invalid={!!errors.email}>
                  <FieldLabel htmlFor="sa-email">Email</FieldLabel>
                  <Input
                    id="sa-email"
                    type="email"
                    autoComplete="username"
                    autoFocus
                    aria-invalid={!!errors.email}
                    {...form.register('email')}
                  />
                  <FieldError errors={[errors.email]} />
                </Field>
                <Field data-invalid={!!errors.password}>
                  <FieldLabel htmlFor="sa-password">Mot de passe</FieldLabel>
                  <Input
                    id="sa-password"
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
          )}
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Session limitée à cet onglet, fermée après 30 minutes d’inactivité. Les tentatives répétées bloquent le compte 15 minutes.
        </p>
      </div>
    </div>
  )
}

/** Deuxième étape : code à 6 chiffres de l'application, ou code de secours. */
function MfaStep() {
  const { verifyMfa, cancelMfa } = usePlatformAuth()
  const [code, setCode] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const valid = recovery ? code.trim().length >= 8 : /^\d{6}$/.test(code)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      await verifyMfa(code)
    } catch (err) {
      setError(errorMessage(err))
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <FieldGroup>
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-medium">Double authentification</p>
            <p className="text-sm text-muted-foreground">
              {recovery
                ? 'Saisissez l’un de vos codes de secours. Chacun ne sert qu’une fois.'
                : 'Saisissez le code à 6 chiffres affiché par votre application d’authentification.'}
            </p>
          </div>
        </div>
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="sa-code">{recovery ? 'Code de secours' : 'Code'}</FieldLabel>
          <Input
            id="sa-code"
            autoFocus
            key={recovery ? 'recovery' : 'totp'}
            inputMode={recovery ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            placeholder={recovery ? 'abcd-efgh' : '123456'}
            maxLength={recovery ? 20 : 6}
            className={recovery ? undefined : 'text-center font-mono text-lg tracking-[0.5em]'}
            value={code}
            onChange={(e) => setCode(recovery ? e.target.value : e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={!valid || busy} className="w-full">
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          Vérifier
        </Button>
        <div className="flex justify-between text-sm">
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={cancelMfa}>
            Retour
          </button>
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => {
              setRecovery(!recovery)
              setCode('')
              setError(null)
            }}
          >
            {recovery ? 'Utiliser l’application' : 'Utiliser un code de secours'}
          </button>
        </div>
      </FieldGroup>
    </form>
  )
}
