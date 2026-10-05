import { Feature, ProgressMethod, Role } from '@suivi/shared'
import { Coins, Loader2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { useApiMutation } from '@/lib/queries'
import { useFeature } from '@/lib/subscription'
import type { MissionDetail } from '@/lib/types'
import { PayFields } from '../payroll/PayFields'
import { describePay, draftFrom, draftInvalid, payFromDraft, type PayDraft } from '../payroll/pay-draft'

/**
 * Rémunération de la mission (formule Entreprise). Par défaut, chaque agent est payé selon sa
 * grille ; l'administrateur peut fixer des conditions propres, qui remplacent la grille ici.
 */
export function MissionPayCard({ mission }: { mission: MissionDetail }) {
  const { user } = useMe()
  const enabled = useFeature(Feature.Payroll)
  const [editing, setEditing] = useState(false)
  const admin = user.role === Role.Admin
  const sum = mission.progressMethod === ProgressMethod.FieldSum
  const typePay = mission.type.pay ?? null

  const clear = useApiMutation(() => api.delete(`/missions/${mission.id}/pay`), {
    success: typePay ? 'La mission suit de nouveau les conditions de son type' : 'La mission suit de nouveau la grille de chaque agent',
    invalidate: [['missions'], ['pay']],
  })

  if (!enabled) return null
  if (!admin)
    return mission.hasOwnPay || mission.type.hasPay ? (
      <section className="flex flex-col gap-1 rounded-lg border bg-card p-4" aria-label="Rémunération">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Coins className="size-4 text-muted-foreground" aria-hidden /> Rémunération
        </h2>
        <p className="text-sm text-muted-foreground">
          {mission.hasOwnPay ? 'Rémunération propre à cette mission' : `Rémunération du type « ${mission.type.name} »`}, fixée par
          l’administrateur.
        </p>
      </section>
    ) : null

  // La mission, sinon son type, sinon la grille de chaque agent.
  const effective = mission.pay ?? typePay
  const lines = effective ? describePay(effective, sum) : []
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4" aria-label="Rémunération">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Coins className="size-4 text-muted-foreground" aria-hidden /> Rémunération
      </h2>
      {effective ? (
        <>
          {lines.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">Cette mission ne rapporte rien en plus (fixe et journées seulement).</p>
          )}
          <p className="text-xs text-muted-foreground">
            {mission.pay
              ? 'Conditions propres à cette mission : elles remplacent celles du type et la grille des agents.'
              : `Conditions du type « ${mission.type.name} » (menu Types de missions) : elles remplacent la grille des agents.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              {mission.pay ? 'Modifier' : 'Conditions propres à cette mission'}
            </Button>
            {mission.pay && (
              <Button size="sm" variant="ghost" disabled={clear.isPending} onClick={() => clear.mutate(undefined)}>
                <Undo2 aria-hidden /> {typePay ? 'Revenir aux conditions du type' : 'Revenir à la grille'}
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Chaque agent est payé selon sa grille de rémunération. Vous pouvez aussi régler la paie de tout le type « {mission.type.name} »
            dans Types de missions.
          </p>
          <Button size="sm" variant="outline" className="w-fit" onClick={() => setEditing(true)}>
            Conditions propres à cette mission
          </Button>
        </>
      )}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          {editing && <PayForm mission={mission} sum={sum} onDone={() => setEditing(false)} />}
        </DialogContent>
      </Dialog>
    </section>
  )
}

function PayForm({ mission, sum, onDone }: { mission: MissionDetail; sum: boolean; onDone: () => void }) {
  // Point de départ : les conditions de la mission, sinon celles de son type.
  const [draft, setDraft] = useState<PayDraft>(() => draftFrom(mission.pay ?? mission.type.pay))
  const invalid = draftInvalid(draft)
  const save = useApiMutation(
    () => {
      const pay = payFromDraft(draft)
      return api.put(`/missions/${mission.id}/pay`, {
        ...pay,
        commissionPercent: sum ? pay.commissionPercent : null,
        leadPerTeamForm: mission.assigneeGroupId ? pay.leadPerTeamForm : null,
      })
    },
    { success: 'Rémunération de la mission enregistrée', invalidate: [['missions'], ['pay']], onSuccess: onDone },
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle>Rémunération de la mission</DialogTitle>
        <DialogDescription>
          Ces conditions remplacent celles du type et la grille des agents pour les formulaires et l’objectif de « {mission.title} ». Le
          fixe, les journées, les retenues et le plafond restent ceux de la grille. Laissez un champ vide pour ne rien verser.
        </DialogDescription>
      </DialogHeader>
      <PayFields draft={draft} onChange={setDraft} commission={sum} lead={!!mission.assigneeGroupId} id="mp" />
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button disabled={!!invalid || save.isPending} onClick={() => save.mutate(undefined)}>
          {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Enregistrer
        </Button>
      </DialogFooter>
    </>
  )
}
