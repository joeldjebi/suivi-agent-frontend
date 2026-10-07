import { ApprovalMode, DayStatus, ExpirationAction, FieldType, MissionStatus, ProgressMethod, Role, ZoneRequestStatus } from '@suivi/shared'

/** Libellés français des valeurs métier. */

export const roleLabel: Record<Role, string> = {
  [Role.Admin]: 'Administrateur',
  [Role.TeamLead]: "Chef d'équipe",
  [Role.Agent]: 'Agent',
}

export const dayStatusLabel: Record<DayStatus, string> = {
  [DayStatus.Active]: 'En cours',
  [DayStatus.Paused]: 'En pause',
  [DayStatus.Ended]: 'Terminée',
}

export const requestStatusLabel: Record<ZoneRequestStatus, string> = {
  [ZoneRequestStatus.Pending]: 'En attente',
  [ZoneRequestStatus.Approved]: 'Approuvée',
  [ZoneRequestStatus.Rejected]: 'Refusée',
  [ZoneRequestStatus.Expired]: 'Expirée',
  [ZoneRequestStatus.Cancelled]: 'Annulée',
  [ZoneRequestStatus.Released]: 'Place libérée',
}

export const approvalModeLabel: Record<ApprovalMode, string> = {
  [ApprovalMode.Automatic]: 'Automatique',
  [ApprovalMode.Manual]: 'Manuel',
  [ApprovalMode.Mixed]: 'Mixte',
}

export const expirationActionLabel: Record<ExpirationAction, string> = {
  [ExpirationAction.AutoApprove]: 'Approuver automatiquement',
  [ExpirationAction.ReleaseSeat]: 'Libérer la place',
}

export const missionStatusLabel: Record<MissionStatus, string> = {
  [MissionStatus.Todo]: 'À faire',
  [MissionStatus.InProgress]: 'En cours',
  [MissionStatus.Achieved]: 'Atteinte',
  [MissionStatus.Failed]: 'Échouée',
}

export const progressMethodLabel: Record<ProgressMethod, string> = {
  [ProgressMethod.Count]: 'Nombre de formulaires',
  [ProgressMethod.FieldSum]: "Somme d'un champ",
  [ProgressMethod.Manual]: 'Validation manuelle',
}

export const fieldTypeLabel: Record<FieldType, string> = {
  [FieldType.Text]: 'Texte',
  [FieldType.Number]: 'Nombre',
  [FieldType.Boolean]: 'Oui / Non',
  [FieldType.Date]: 'Date',
  [FieldType.Select]: 'Liste de choix',
  [FieldType.Photo]: 'Photo géolocalisée',
}

export const releaseReasonLabel: Record<string, string> = {
  zone_change: 'Changement de zone',
  day_ended: 'Fin de journée',
  daily_reset: 'Remise à zéro quotidienne',
  reassigned: 'Réaffectation',
  rejected: 'Refus',
  expired: 'Expiration',
  cancelled_by_agent: "Annulée par l'agent",
  zone_deactivated: 'Zone fermée',
}
