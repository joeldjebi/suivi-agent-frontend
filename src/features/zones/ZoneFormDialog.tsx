import { zodResolver } from '@hookform/resolvers/zod'
import type { Polygon } from 'geojson'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { useApiMutation } from '@/lib/queries'
import type { Zone } from '@/lib/types'

const schema = z.object({
  name: z.string().trim().min(1, 'Nom requis'),
  capacity: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) > 0), 'Nombre entier supérieur à 0, ou vide pour illimité'),
  sensitive: z.boolean(),
  restricted: z.boolean(),
})
type Values = z.infer<typeof schema>

export function ZoneFormDialog({
  open,
  onOpenChange,
  zone,
  area,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Zone à modifier ; absente pour une création. */
  zone?: Zone
  /** Tracé dessiné (création) */
  area?: Polygon
}) {
  const { settings } = useMe()
  const form = useForm<Values>({ resolver: zodResolver(schema) })
  const { errors } = form.formState

  useEffect(() => {
    if (open) {
      form.reset({
        name: zone?.name ?? '',
        capacity: zone?.capacity ? String(zone.capacity) : '',
        sensitive: zone?.sensitive ?? false,
        restricted: zone?.restricted ?? false,
      })
    }
  }, [open, zone, form])

  const save = useApiMutation(
    async (values: Values) => {
      const body = {
        name: values.name,
        capacity: values.capacity === '' ? null : Number(values.capacity),
        sensitive: values.sensitive,
        restricted: values.restricted,
      }
      if (zone) await api.patch(`/zones/${zone.id}`, body)
      else await api.post('/zones', { ...body, area })
    },
    {
      success: zone ? 'Zone mise à jour' : 'Zone créée',
      invalidate: [['zones']],
      onSuccess: () => onOpenChange(false),
    },
  )

  const toggle = (name: 'sensitive' | 'restricted', label: string, description: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            <FieldDescription>{description}</FieldDescription>
          </FieldContent>
          <Switch id={name} checked={field.value} onCheckedChange={field.onChange} />
        </Field>
      )}
    />
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{zone ? 'Modifier la zone' : 'Nouvelle zone'}</DialogTitle>
          <DialogDescription>
            {zone ? 'Le tracé se modifie depuis la carte.' : 'Le tracé que vous venez de dessiner sera enregistré avec la zone.'}
          </DialogDescription>
        </DialogHeader>
        <form id="zone-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="zone-name">Nom</FieldLabel>
              <Input id="zone-name" autoFocus aria-invalid={!!errors.name} {...form.register('name')} />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.capacity}>
              <FieldLabel htmlFor="zone-capacity">Nombre maximum d'agents</FieldLabel>
              <Input
                id="zone-capacity"
                inputMode="numeric"
                placeholder="Illimité"
                aria-invalid={!!errors.capacity}
                {...form.register('capacity')}
              />
              <FieldDescription>Une zone pleine n'est plus proposée aux agents.</FieldDescription>
              <FieldError errors={[errors.capacity]} />
            </Field>
            {toggle('sensitive', 'Zone sensible', 'En mode d’approbation mixte, les choix de cette zone sont validés manuellement.')}
            {!settings.useGroups &&
              toggle(
                'restricted',
                'Zone réservée',
                'Accessible uniquement aux agents que vous autorisez (si la restriction est activée dans les paramètres).',
              )}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="zone-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
