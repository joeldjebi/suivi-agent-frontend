import { Role } from '@suivi/shared'
import { MoreHorizontal, PenLine, UserCheck, UserX } from 'lucide-react'
import { useState } from 'react'
import { IMPACT_LABELS, RemoveDialog } from '@/components/app/remove-dialog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { UserFormDialog } from '@/features/users/UserFormDialog'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { fullName } from '@/lib/format'
import { useApiMutation } from '@/lib/queries'
import type { LeadStats, User } from '@/lib/types'

/** Compte du chef au format du formulaire utilisateur. */
const asUser = (lead: LeadStats, tenantId: string): User => ({
  id: lead.id,
  tenantId,
  firstName: lead.firstName,
  lastName: lead.lastName,
  email: lead.email,
  phone: lead.phone,
  role: Role.TeamLead,
  groupId: null,
  onProbation: false,
  isActive: lead.isActive,
  createdAt: '',
  lastLoginAt: lead.lastLoginAt,
})

/**
 * Actions sur un chef d'équipe : modifier (identité, numéro tant qu'il ne s'est pas connecté,
 * groupes dirigés), réactiver, désactiver ou supprimer. Menu compact dans la liste, boutons sur
 * la fiche.
 */
export function LeadActions({ lead, variant = 'menu' }: { lead: LeadStats; variant?: 'menu' | 'buttons' }) {
  const { user } = useMe()
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const invalidate = [['team-leads'], ['users'], ['groups'], ['live']]
  const reactivate = useApiMutation(() => api.patch(`/users/${lead.id}`, { isActive: true }), {
    success: 'Compte réactivé',
    invalidate,
  })

  const dialogs = (
    <>
      <UserFormDialog open={editing} onOpenChange={setEditing} user={asUser(lead, user.tenantId)} defaultRole={Role.TeamLead} />
      <RemoveDialog
        target={removing ? { name: fullName(lead), isActive: lead.isActive } : null}
        onOpenChange={(o) => !o && setRemoving(false)}
        config={
          removing
            ? {
                noun: 'le compte de',
                url: `/users/${lead.id}`,
                deactivateLabel: 'Désactiver le compte',
                deactivateEffect: 'Le chef est déconnecté immédiatement ; ses groupes restent en place, sans validation de sa part.',
                impactLabels: IMPACT_LABELS.user,
                invalidate,
              }
            : null
        }
      />
    </>
  )

  if (variant === 'buttons')
    return (
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setEditing(true)}>
          <PenLine aria-hidden /> Modifier
        </Button>
        {lead.isActive ? (
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setRemoving(true)}>
            <UserX aria-hidden /> Désactiver…
          </Button>
        ) : (
          <>
            <Button variant="outline" disabled={reactivate.isPending} onClick={() => reactivate.mutate(undefined)}>
              <UserCheck aria-hidden /> Réactiver
            </Button>
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setRemoving(true)}>
              Supprimer…
            </Button>
          </>
        )}
        {dialogs}
      </div>
    )

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" className="relative z-10" aria-label={`Actions pour ${fullName(lead)}`} />}
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <PenLine aria-hidden /> Modifier
          </DropdownMenuItem>
          {!lead.isActive && (
            <DropdownMenuItem disabled={reactivate.isPending} onClick={() => reactivate.mutate(undefined)}>
              <UserCheck aria-hidden /> Réactiver
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onClick={() => setRemoving(true)}>
            <UserX aria-hidden /> {lead.isActive ? 'Désactiver ou supprimer…' : 'Supprimer définitivement…'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs}
    </>
  )
}
