import { Feature, OnboardingStep, type OnboardingState, type OnboardingStepState } from '@suivi/shared'
import { BookOpen, Check, CircleCheckBig, EyeOff, LifeBuoy, PartyPopper, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Page, PageHeader, QueryState } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { onboardingKey, useOnboarding } from '@/lib/onboarding'
import { useApiMutation } from '@/lib/queries'
import { cn } from '@/lib/utils'

interface StepCopy {
  title: string
  description: string
  /** Ce qu'il faut avoir sous la main (étape des prérequis) */
  checklist?: string[]
  action?: { to: string; label: string }
  help?: string
}

function copyOf(key: OnboardingStep, teamLeads: boolean): StepCopy {
  switch (key) {
    case OnboardingStep.Prerequisites:
      return {
        title: 'Préparer les prérequis',
        description: 'Rassemblez le matériel et les informations nécessaires avant de lancer vos équipes.',
        checklist: [
          'Un smartphone par agent (Android 7 ou iOS 13 minimum), avec GPS, puce et forfait data',
          'La liste des agents avec leur numéro de téléphone (il sert d’identifiant)',
          'Vos secteurs de travail et, si besoin, vos chefs d’équipe',
          'Vos horaires : heure de début, jours travaillés, fin de journée',
        ],
        action: { to: '/help/prerequis', label: 'Lire les prérequis' },
      }
    case OnboardingStep.Settings:
      return {
        title: 'Vérifier les réglages',
        description: 'Fuseau horaire, heure de début attendue, jours travaillés et alertes de votre structure.',
        action: { to: '/settings', label: 'Ouvrir les paramètres' },
        help: 'parametres',
      }
    case OnboardingStep.Zones:
      return {
        title: 'Dessiner vos zones',
        description: 'Tracez sur la carte les secteurs où travaillent vos agents.',
        action: { to: '/zones', label: 'Créer une zone' },
        help: 'zones',
      }
    case OnboardingStep.Teams:
      return {
        title: 'Organiser vos équipes',
        description: 'Nommez vos chefs d’équipe et rattachez-leur des agents et des zones.',
        action: teamLeads ? { to: '/team-leads', label: 'Ajouter un chef d’équipe' } : { to: '/groups', label: 'Créer un groupe' },
        help: 'equipes-et-comptes',
      }
    case OnboardingStep.Agents:
      return {
        title: 'Ajouter vos agents',
        description: 'Créez un compte par agent avec son numéro de téléphone.',
        action: { to: '/users', label: 'Ajouter un agent' },
        help: 'equipes-et-comptes',
      }
    case OnboardingStep.Missions:
      return {
        title: 'Préparer vos formulaires',
        description: 'Créez un type de mission avec les informations que l’agent remplit sur le terrain.',
        action: { to: '/mission-types', label: 'Créer un type de mission' },
        help: 'missions',
      }
    case OnboardingStep.Payroll:
      return {
        title: 'Régler la rémunération',
        description: 'Définissez une grille : fixe, montant par journée ou par formulaire, primes et retenues.',
        action: { to: '/pay', label: 'Créer une grille' },
        help: 'remuneration',
      }
    case OnboardingStep.App:
      return {
        title: 'Installer l’application des agents',
        description:
          'Chaque agent installe Suivi Agent, se connecte avec son numéro et autorise la localisation « Toujours ». L’étape se valide à la première connexion.',
        action: { to: '/users', label: 'Voir les agents' },
        help: 'application-agent',
      }
    case OnboardingStep.FirstDay:
      return {
        title: 'Lancer une première journée',
        description:
          'Un agent démarre sa journée depuis l’application : suivez-le sur la carte en temps réel. Commencez par un essai avec un ou deux agents.',
        action: { to: '/map', label: 'Ouvrir la carte' },
        help: 'carte-temps-reel',
      }
  }
}

/**
 * Guide « Bien démarrer » : les étapes de mise en route de la structure, cochées d'après
 * ses données, avec un accès direct à chaque écran et à l'article d'aide correspondant.
 */
export function OnboardingPage() {
  const { subscription } = useMe()
  const query = useOnboarding()
  const update = useApiMutation((body: { step?: OnboardingStep; done?: boolean; dismissed?: boolean }) => api.patch('/onboarding', body), {
    invalidate: [onboardingKey],
  })
  const teamLeads = subscription.features.includes(Feature.TeamLeads)

  return (
    <Page>
      <PageHeader
        title="Bien démarrer"
        description="Les étapes pour mettre en route votre structure. Elles se cochent toutes seules au fil de votre installation."
        actions={
          query.data && (
            <Button variant="outline" disabled={update.isPending} onClick={() => update.mutate({ dismissed: !query.data.dismissed })}>
              {query.data.dismissed ? <Undo2 aria-hidden /> : <EyeOff aria-hidden />}
              {query.data.dismissed ? 'Réafficher dans le menu' : 'Masquer du menu'}
            </Button>
          )
        }
      />
      <QueryState query={query}>
        {query.data && (
          <Steps state={query.data} teamLeads={teamLeads} busy={update.isPending} onCheck={(step, done) => update.mutate({ step, done })} />
        )}
      </QueryState>
    </Page>
  )
}

function Steps({
  state,
  teamLeads,
  busy,
  onCheck,
}: {
  state: OnboardingState
  teamLeads: boolean
  busy: boolean
  onCheck: (step: OnboardingStep, done: boolean) => void
}) {
  const done = state.steps.filter((s) => s.done).length
  const total = state.steps.length
  const next = state.steps.find((s) => !s.done)?.key
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5" aria-label="Avancement">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium">
            {state.completed ? 'Votre structure est prête' : `${done} étape${done > 1 ? 's' : ''} sur ${total}`}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">{Math.round((done / total) * 100)} %</p>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-label="Étapes terminées"
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        {state.completed && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <PartyPopper className="size-4 text-primary" aria-hidden />
            Toutes les étapes sont faites. Vous pouvez masquer ce guide du menu ; il reste accessible depuis la documentation.
          </p>
        )}
      </section>

      <ol className="flex flex-col gap-3">
        {state.steps.map((step, i) => (
          <StepCard
            key={step.key}
            index={i + 1}
            step={step}
            copy={copyOf(step.key, teamLeads)}
            current={step.key === next}
            busy={busy}
            onCheck={onCheck}
          />
        ))}
      </ol>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <LifeBuoy className="size-4" aria-hidden />
        Besoin d’un coup de main pour démarrer ?
        <Link to="/support" className="font-medium text-primary underline-offset-2 hover:underline">
          Écrivez-nous depuis le support
        </Link>
      </p>
    </div>
  )
}

function StepCard({
  index,
  step,
  copy,
  current,
  busy,
  onCheck,
}: {
  index: number
  step: OnboardingStepState
  copy: StepCopy
  current: boolean
  busy: boolean
  onCheck: (step: OnboardingStep, done: boolean) => void
}) {
  return (
    <li
      className={cn(
        'flex gap-4 rounded-xl border bg-card p-4 sm:p-5',
        current && 'border-primary/50 ring-3 ring-primary/10',
        step.done && 'bg-muted/30',
      )}
      aria-current={current ? 'step' : undefined}
    >
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums',
          step.done
            ? 'border-status-active bg-status-active text-white'
            : current
              ? 'border-primary text-primary'
              : 'text-muted-foreground',
        )}
      >
        {step.done ? <Check className="size-4" aria-label="Fait" /> : index}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <h2 className={cn('font-medium', step.done && 'text-muted-foreground')}>{copy.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{copy.description}</p>
        </div>
        {copy.checklist && !step.done && (
          <ul className="flex flex-col gap-1 text-sm">
            {copy.checklist.map((item) => (
              <li key={item} className="flex gap-2">
                <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {copy.action && (
            <LinkButton to={copy.action.to} primary={current}>
              {copy.action.label}
            </LinkButton>
          )}
          {step.manual &&
            (step.done ? (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => onCheck(step.key, false)}>
                <Undo2 aria-hidden /> Annuler
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => onCheck(step.key, true)}>
                <Check aria-hidden /> C’est fait
              </Button>
            ))}
          {copy.help && (
            <Link
              to={`/help/${copy.help}`}
              className="inline-flex h-8 items-center gap-1.5 px-2 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              <BookOpen className="size-3.5" aria-hidden /> Aide
            </Link>
          )}
        </div>
      </div>
    </li>
  )
}

function LinkButton({ to, primary, children }: { to: string; primary: boolean; children: ReactNode }) {
  return (
    <Button size="sm" variant={primary ? 'default' : 'outline'} nativeButton={false} render={<Link to={to} />}>
      {children}
    </Button>
  )
}
