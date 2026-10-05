import { ApprovalMode, ExpirationAction, Feature, ZoneAccessWithoutGroups } from '@suivi/shared'
import { Loader2, Lock, Save } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Page, PageHeader } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { useAuth, useMe } from '@/lib/auth'
import { approvalModeLabel, expirationActionLabel } from '@/lib/labels'
import { useApiMutation } from '@/lib/queries'
import type { Settings } from '@/lib/types'

const TIMEZONES = ['Africa/Abidjan', 'Africa/Dakar', 'Africa/Lagos', 'Africa/Douala', 'Africa/Casablanca', 'Europe/Paris']

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-[16rem_1fr] md:gap-8 md:p-5">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
  locked,
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
  /** Réglage hors formule : explication à la place du contrôle actif */
  locked?: string
}) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
        {locked && <LockedNote text={locked} />}
      </FieldContent>
      <Switch id={id} checked={checked} disabled={!!locked} onCheckedChange={onChange} />
    </Field>
  )
}

function LockedNote({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Lock className="size-3.5" aria-hidden /> {text}
    </p>
  )
}

/** Message de verrouillage d'un réglage absent de la formule. */
function useLocked(feature: Feature): string | undefined {
  const { subscription } = useMe()
  if (subscription.features.includes(feature)) return undefined
  const upgrade = subscription.upgrades?.[feature]
  return upgrade ? `Inclus dans la formule ${upgrade.name}` : 'Non inclus dans votre formule'
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  description,
  locked,
}: {
  label: string
  value: T
  options: Record<T, string>
  onChange: (v: T) => void
  description?: string
  locked?: string
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {locked && <LockedNote text={locked} />}
      <Select value={value} disabled={!!locked} onValueChange={(v) => v && onChange(v as T)}>
        <SelectTrigger className="w-full sm:w-72" aria-label={label}>
          <SelectValue>{(v: T) => options[v]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(options) as T[]).map((k) => (
            <SelectItem key={k} value={k}>
              {options[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  )
}

function NumberInput({
  id,
  label,
  value,
  onChange,
  suffix,
  min,
  max,
  description,
}: {
  id: string
  label: string
  value: number
  onChange: (v: number) => void
  suffix: string
  min: number
  max: number
  description?: string
}) {
  const invalid = !Number.isInteger(value) || value < min || value > max
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          className="w-28"
          value={Number.isNaN(value) ? '' : value}
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.valueAsNumber)}
        />
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
      <FieldDescription>{invalid ? `Entre ${min} et ${max}.` : description}</FieldDescription>
    </Field>
  )
}

export function SettingsPage() {
  const { settings } = useMe()
  // Nouveau brouillon dès que les paramètres enregistrés changent.
  return <SettingsForm key={JSON.stringify(settings)} settings={settings} />
}

function SettingsForm({ settings }: { settings: Settings }) {
  const { reload } = useAuth()
  const [draft, setDraft] = useState<Settings>(settings)
  const groupsLocked = useLocked(Feature.Groups)
  const approvalLocked = useLocked(Feature.ManualApproval)

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)
  const valid =
    [
      draft.requestExpirationMinutes,
      draft.signalLostMinutes,
      draft.zoneExitToleranceMeters,
      draft.zoneExitAlertMinutes,
      draft.positionRetentionDays,
      draft.alertLateMinutes,
      draft.alertImmobileRadiusM,
      draft.alertImmobileMinutes ?? 0,
      draft.alertBatteryPercent ?? 0,
    ].every(Number.isInteger) &&
    (draft.alertStartTime === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.alertStartTime)) &&
    (draft.dailyReportTime === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.dailyReportTime)) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.dailyResetTime)

  const save = useApiMutation(
    () => {
      // L'API refuse les champs non modifiables (tenantId, updatedAt).
      const body: Partial<Settings> & { updatedAt?: string } = { ...draft }
      delete body.tenantId
      delete body.updatedAt
      return api.patch('/settings', body)
    },
    { success: 'Paramètres enregistrés', invalidate: [['zones'], ['groups']], onSuccess: () => void reload() },
  )

  const manual = draft.approvalMode !== ApprovalMode.Automatic
  const c = draft.mixedCriteria

  return (
    <Page>
      <PageHeader
        title="Paramètres de la structure"
        description="Adaptez la plateforme à votre fonctionnement. Chaque paramètre a une valeur par défaut raisonnable."
        actions={
          <Button disabled={!dirty || !valid || save.isPending} onClick={() => save.mutate(undefined)}>
            {save.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            Enregistrer
          </Button>
        }
      />

      <Section title="Organisation" description="Groupes, chefs d'équipe et accès aux zones.">
        <Toggle
          id="useGroups"
          label="Utiliser les groupes et les chefs d'équipe"
          description="Chaque agent choisit parmi les zones de son groupe ; le chef d'équipe approuve ses demandes."
          checked={draft.useGroups}
          onChange={(v) => set('useGroups', v)}
          locked={groupsLocked}
        />
        {!draft.useGroups && (
          <Choice
            label="Zones accessibles aux agents"
            value={draft.zoneAccessWithoutGroups}
            options={{
              [ZoneAccessWithoutGroups.All]: 'Toutes les zones',
              [ZoneAccessWithoutGroups.Restricted]: 'Zones réservées à certains agents',
            }}
            onChange={(v) => set('zoneAccessWithoutGroups', v)}
            description="Avec la restriction, les zones marquées « réservées » ne sont visibles que des agents autorisés."
          />
        )}
      </Section>

      <Section title="Choix de zone" description="Comment les choix de zone des agents sont validés.">
        <Choice
          label="Mode d'approbation"
          value={draft.approvalMode}
          options={approvalModeLabel}
          onChange={(v) => set('approvalMode', v)}
          locked={approvalLocked}
          description={
            {
              [ApprovalMode.Automatic]: 'Le choix de l’agent est validé immédiatement.',
              [ApprovalMode.Manual]: 'Chaque choix doit être approuvé par le chef d’équipe ou l’administrateur.',
              [ApprovalMode.Mixed]: 'Approbation manuelle seulement dans les cas cochés ci-dessous.',
            }[draft.approvalMode]
          }
        />
        {draft.approvalMode === ApprovalMode.Mixed && (
          <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3">
            <p className="text-sm font-medium">Approbation manuelle si…</p>
            <Toggle
              id="c-sensitive"
              label="La zone est marquée sensible"
              checked={c.sensitiveZone}
              onChange={(v) => set('mixedCriteria', { ...c, sensitiveZone: v })}
            />
            <Toggle
              id="c-change"
              label="L'agent change de zone"
              checked={c.zoneChange}
              onChange={(v) => set('mixedCriteria', { ...c, zoneChange: v })}
            />
            <Toggle
              id="c-probation"
              label="L'agent est en période d'essai"
              checked={c.probationAgent}
              onChange={(v) => set('mixedCriteria', { ...c, probationAgent: v })}
            />
            <Toggle
              id="c-fill"
              label="La zone est presque pleine"
              checked={c.fillThresholdPercent !== null}
              onChange={(v) => set('mixedCriteria', { ...c, fillThresholdPercent: v ? 80 : null })}
            />
            {c.fillThresholdPercent !== null && (
              <NumberInput
                id="c-threshold"
                label="Seuil de remplissage"
                value={c.fillThresholdPercent}
                min={1}
                max={100}
                suffix="%"
                onChange={(v) => set('mixedCriteria', { ...c, fillThresholdPercent: v })}
              />
            )}
          </div>
        )}
        {manual && (
          <>
            <NumberInput
              id="expiration"
              label="Délai d'expiration d'une demande"
              value={draft.requestExpirationMinutes}
              min={1}
              max={1440}
              suffix="minutes"
              onChange={(v) => set('requestExpirationMinutes', v)}
              description="La place reste réservée pendant ce délai. Une relance est envoyée à mi-délai."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Choice
                label="À l'expiration (mode manuel)"
                value={draft.expirationActionManual}
                options={expirationActionLabel}
                onChange={(v) => set('expirationActionManual', v as ExpirationAction)}
              />
              <Choice
                label="À l'expiration (mode mixte)"
                value={draft.expirationActionMixed}
                options={expirationActionLabel}
                onChange={(v) => set('expirationActionMixed', v as ExpirationAction)}
              />
            </div>
          </>
        )}
        <Separator />
        <Toggle
          id="allowChange"
          label="Changement de zone avant le démarrage"
          description="L'agent peut changer de zone tant qu'il n'a pas démarré sa journée."
          checked={draft.allowZoneChangeBeforeStart}
          onChange={(v) => set('allowZoneChangeBeforeStart', v)}
        />
      </Section>

      <Section title="Journée de travail" description="Démarrage, pause et remise à zéro quotidienne.">
        <Toggle
          id="zoneRequired"
          label="Zone obligatoire pour démarrer"
          checked={draft.zoneRequired}
          onChange={(v) => set('zoneRequired', v)}
        />
        {manual && (
          <Toggle
            id="startPending"
            label="Démarrage autorisé pendant l'attente d'approbation"
            description="La journée reçoit sa zone dès l'approbation."
            checked={draft.startWhilePending}
            onChange={(v) => set('startWhilePending', v)}
          />
        )}
        <Toggle
          id="trackPause"
          label="Suivre la position pendant la pause"
          description="Désactivé par défaut pour respecter la vie privée des agents (ARTCI)."
          checked={draft.trackDuringPause}
          onChange={(v) => set('trackDuringPause', v)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.dailyResetTime)}>
            <FieldLabel htmlFor="resetTime">Heure de remise à zéro des places</FieldLabel>
            <div>
              <Input
                id="resetTime"
                type="time"
                className="w-32"
                value={draft.dailyResetTime}
                onChange={(e) => set('dailyResetTime', e.target.value)}
              />
            </div>
          </Field>
          <Choice
            label="Fuseau horaire"
            value={draft.timezone}
            options={Object.fromEntries([...new Set([draft.timezone, ...TIMEZONES])].map((t) => [t, t.replace('_', ' ')]))}
            onChange={(v) => set('timezone', v)}
          />
        </div>
        <Toggle
          id="autoEnd"
          label="Terminer automatiquement les journées oubliées"
          description="À l'heure de remise à zéro, les journées encore ouvertes sont terminées et le suivi s'arrête."
          checked={draft.autoEndDayAtReset}
          onChange={(v) => set('autoEndDayAtReset', v)}
        />
      </Section>

      <Section title="Suivi et données" description="Alertes de la carte, sorties de zone et conservation des positions.">
        <NumberInput
          id="signalLost"
          label="Délai avant « signal perdu »"
          value={draft.signalLostMinutes}
          min={1}
          max={240}
          suffix="minutes"
          onChange={(v) => set('signalLostMinutes', v)}
          description="Sans position pendant ce délai, l'agent est signalé sur la carte."
        />
        <NumberInput
          id="zoneExitTolerance"
          label="Marge autour des zones"
          value={draft.zoneExitToleranceMeters}
          min={0}
          max={500}
          suffix="mètres"
          onChange={(v) => set('zoneExitToleranceMeters', v)}
          description="Un agent n'est compté hors zone qu'au-delà de cette marge : le GPS est souvent imprécis de quelques dizaines de mètres."
        />
        <NumberInput
          id="zoneExitAlert"
          label="Alerte de sortie de zone"
          value={draft.zoneExitAlertMinutes}
          min={1}
          max={120}
          suffix="minutes"
          onChange={(v) => set('zoneExitAlertMinutes', v)}
          description="Hors de sa zone au-delà de ce délai, l'agent est signalé à son responsable, puis à son retour."
        />
        <NumberInput
          id="retention"
          label="Conservation des positions"
          value={draft.positionRetentionDays}
          min={1}
          max={3650}
          suffix="jours"
          onChange={(v) => set('positionRetentionDays', v)}
          description="Les positions plus anciennes sont supprimées chaque nuit."
        />
      </Section>

      <Section
        title="Alertes des responsables"
        description="Le chef de l’agent est prévenu, et l’alerte apparaît dans « Alertes ». Elle se referme d’elle-même quand la situation se règle."
      >
        <Toggle
          id="dailyReport"
          label="Bilan de fin de journée"
          description="Chaque responsable reçoit le bilan de son équipe : qui a travaillé, temps, formulaires, alertes."
          checked={draft.dailyReportTime !== null}
          onChange={(v) => set('dailyReportTime', v ? '19:00' : null)}
        />
        {draft.dailyReportTime !== null && (
          <Field data-invalid={!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.dailyReportTime)}>
            <FieldLabel htmlFor="reportTime">Heure d’envoi du bilan</FieldLabel>
            <div>
              <Input
                id="reportTime"
                type="time"
                className="w-32"
                value={draft.dailyReportTime}
                onChange={(e) => set('dailyReportTime', e.target.value)}
              />
            </div>
          </Field>
        )}
        <Toggle
          id="alertSignal"
          label="Signal perdu"
          description={`Aucune position pendant ${draft.signalLostMinutes} min (délai ci-dessus) : GPS coupé, application fermée ou réseau absent.`}
          checked={draft.alertSignalLost}
          onChange={(v) => set('alertSignalLost', v)}
        />
        <Toggle
          id="alertMocked"
          label="Position simulée"
          description="Une application de fausse position GPS est détectée sur le téléphone."
          checked={draft.alertMocked}
          onChange={(v) => set('alertMocked', v)}
        />
        <Toggle
          id="alertImmobile"
          label="Agent immobile"
          description="Pas de déplacement notable pendant un moment, hors pause."
          checked={draft.alertImmobileMinutes !== null}
          onChange={(v) => set('alertImmobileMinutes', v ? 45 : null)}
        />
        {draft.alertImmobileMinutes !== null && (
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberInput
              id="immobileMinutes"
              label="Immobile depuis"
              value={draft.alertImmobileMinutes}
              min={15}
              max={480}
              suffix="minutes"
              onChange={(v) => set('alertImmobileMinutes', v)}
            />
            <NumberInput
              id="immobileRadius"
              label="Dans un rayon de"
              value={draft.alertImmobileRadiusM}
              min={30}
              max={2000}
              suffix="mètres"
              onChange={(v) => set('alertImmobileRadiusM', v)}
            />
          </div>
        )}
        <Toggle
          id="alertBattery"
          label="Batterie faible"
          description="Le suivi risque de s’arrêter : le chef peut prévenir l’agent avant."
          checked={draft.alertBatteryPercent !== null}
          onChange={(v) => set('alertBatteryPercent', v ? 15 : null)}
        />
        {draft.alertBatteryPercent !== null && (
          <NumberInput
            id="batteryPercent"
            label="Seuil"
            value={draft.alertBatteryPercent}
            min={5}
            max={50}
            suffix="%"
            onChange={(v) => set('alertBatteryPercent', v)}
          />
        )}
        <Toggle
          id="alertLate"
          label="Journée pas démarrée"
          description="Après l’heure de début, un message groupé liste les agents qui n’ont pas démarré (ceux qui ont travaillé ces 30 derniers jours)."
          checked={draft.alertStartTime !== null}
          onChange={(v) => set('alertStartTime', v ? '08:00' : null)}
        />
        {draft.alertStartTime !== null && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.alertStartTime)}>
                <FieldLabel htmlFor="startTime">Heure de début attendue</FieldLabel>
                <div>
                  <Input
                    id="startTime"
                    type="time"
                    className="w-32"
                    value={draft.alertStartTime}
                    onChange={(e) => set('alertStartTime', e.target.value)}
                  />
                </div>
              </Field>
              <NumberInput
                id="lateMinutes"
                label="Alerte après"
                value={draft.alertLateMinutes}
                min={0}
                max={240}
                suffix="minutes de retard"
                onChange={(v) => set('alertLateMinutes', v)}
              />
            </div>
            <Field>
              <FieldLabel>Jours travaillés</FieldLabel>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Jours travaillés">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((label, i) => {
                  const day = i + 1
                  const on = draft.alertWorkdays.includes(day)
                  return (
                    <Button
                      key={day}
                      type="button"
                      size="sm"
                      variant={on ? 'default' : 'outline'}
                      aria-pressed={on}
                      onClick={() =>
                        set('alertWorkdays', on ? draft.alertWorkdays.filter((d) => d !== day) : [...draft.alertWorkdays, day].sort())
                      }
                    >
                      {label}
                    </Button>
                  )
                })}
              </div>
            </Field>
          </div>
        )}
      </Section>
    </Page>
  )
}
