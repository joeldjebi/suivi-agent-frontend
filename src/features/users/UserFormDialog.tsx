import { zodResolver } from '@hookform/resolvers/zod'
import { Role } from '@suivi/shared'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { roleLabel } from '@/lib/labels'
import { useApiMutation, useGroups } from '@/lib/queries'
import type { User } from '@/lib/types'

const NO_GROUP = 'none'

const schema = (creating: boolean) =>
  z
    .object({
      firstName: z.string().trim().min(1, 'Prénom requis'),
      lastName: z.string().trim().min(1, 'Nom requis'),
      email: z.email('Adresse email invalide'),
      phone: z.string().trim(),
      role: z.enum([Role.Admin, Role.TeamLead, Role.Agent]),
      groupId: z.string(),
      onProbation: z.boolean(),
      password: creating
        ? z.string().min(8, 'Au moins 8 caractères')
        : z.string().refine((v) => v === '' || v.length >= 8, 'Au moins 8 caractères, ou vide pour ne pas changer'),
    })
    .refine((v) => v.role === Role.Admin || v.phone.length > 0, {
      path: ['phone'],
      message: "Numéro obligatoire : c'est l'identifiant de connexion à l'app mobile",
    })

type Values = z.infer<ReturnType<typeof schema>>

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  defaultRole = Role.Agent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: User
  /** Rôle proposé à la création (ex. depuis la page des chefs d'équipe) */
  defaultRole?: Role
}) {
  const { settings } = useMe()
  const groups = useGroups()
  const creating = !user
  const form = useForm<Values>({ resolver: zodResolver(schema(creating)) })
  const { errors } = form.formState
  const role = useWatch({ control: form.control, name: 'role' })
  // Agents et chefs d'équipe se connectent à l'app mobile avec leur numéro.
  const phoneRequired = role !== Role.Admin

  useEffect(() => {
    if (open) {
      form.reset({
        firstName: user?.firstName ?? '',
        lastName: user?.lastName ?? '',
        email: user?.email ?? '',
        phone: user?.phone ?? '',
        role: user?.role ?? defaultRole,
        groupId: user?.groupId ?? NO_GROUP,
        onProbation: user?.onProbation ?? false,
        password: '',
      })
    }
  }, [open, user, defaultRole, form])

  const save = useApiMutation(
    (v: Values) => {
      const body = {
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email,
        phone: v.phone || null,
        role: v.role,
        groupId: v.role === Role.Agent && settings.useGroups && v.groupId !== NO_GROUP ? v.groupId : null,
        onProbation: v.onProbation,
        password: v.password || undefined,
      }
      return creating ? api.post('/users', body) : api.patch(`/users/${user.id}`, body)
    },
    {
      success: creating ? 'Utilisateur créé' : 'Utilisateur mis à jour',
      invalidate: [['users'], ['groups'], ['team-leads']],
      onSuccess: () => onOpenChange(false),
    },
  )

  const input = (
    name: 'firstName' | 'lastName' | 'email' | 'phone' | 'password',
    label: string,
    props: React.ComponentProps<'input'> = {},
  ) => (
    <Field data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={`user-${name}`}>{label}</FieldLabel>
      <Input id={`user-${name}`} aria-invalid={!!errors[name]} {...props} {...form.register(name)} />
      <FieldError errors={[errors[name]]} />
    </Field>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{creating ? 'Nouvel utilisateur' : 'Modifier l’utilisateur'}</DialogTitle>
          <DialogDescription>
            {creating
              ? 'Communiquez l’email et le mot de passe à la personne : elle se connectera avec ces identifiants.'
              : 'Laissez le mot de passe vide pour le conserver.'}
          </DialogDescription>
        </DialogHeader>
        <form id="user-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              {input('firstName', 'Prénom', { autoFocus: true })}
              {input('lastName', 'Nom')}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {input('email', 'Email', { type: 'email', autoComplete: 'off' })}
              <Field data-invalid={!!errors.phone}>
                <FieldLabel htmlFor="user-phone">{phoneRequired ? 'Téléphone' : 'Téléphone (facultatif)'}</FieldLabel>
                <Input
                  id="user-phone"
                  type="tel"
                  autoComplete="off"
                  placeholder="07 00 00 00 00"
                  aria-invalid={!!errors.phone}
                  {...form.register('phone')}
                />
                {phoneRequired && !errors.phone && <FieldDescription>Identifiant de connexion à l'app mobile.</FieldDescription>}
                <FieldError errors={[errors.phone]} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Rôle</FieldLabel>
                    <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                      <SelectTrigger className="w-full" aria-label="Rôle">
                        <SelectValue>{(v: Role) => roleLabel[v]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {[Role.Agent, Role.TeamLead, Role.Admin]
                          .filter((r) => settings.useGroups || r !== Role.TeamLead || user?.role === Role.TeamLead)
                          .map((r) => (
                            <SelectItem key={r} value={r}>
                              {roleLabel[r]}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              {role === Role.Agent && settings.useGroups && (
                <Controller
                  control={form.control}
                  name="groupId"
                  render={({ field }) => (
                    <Field>
                      <FieldLabel>Groupe</FieldLabel>
                      <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                        <SelectTrigger className="w-full" aria-label="Groupe">
                          <SelectValue>
                            {(v: string) => (v === NO_GROUP ? 'Aucun groupe' : groups.data?.find((g) => g.id === v)?.name)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_GROUP}>Aucun groupe</SelectItem>
                          {groups.data?.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              )}
            </div>
            {role === Role.Agent && (
              <Controller
                control={form.control}
                name="onProbation"
                render={({ field }) => (
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldLabel htmlFor="user-probation">Période d'essai</FieldLabel>
                      <FieldDescription>En mode mixte, ses choix de zone peuvent nécessiter une approbation.</FieldDescription>
                    </FieldContent>
                    <Switch id="user-probation" checked={field.value} onCheckedChange={field.onChange} />
                  </Field>
                )}
              />
            )}
            {input('password', creating ? 'Mot de passe initial' : 'Nouveau mot de passe', {
              type: 'password',
              autoComplete: 'new-password',
            })}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="user-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
