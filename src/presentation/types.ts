/** Informations d'un client qui personnalisent sa présentation (voir l'API /platform/presentations). */
export interface PresentationContent {
  clientName: string
  trade: string
  city: string
  areas: string[]
  agents: number
  leads: number
  products: string[]
  /** Comment le client appelle ses points de vente (« boutiques, maquis et supérettes »). */
  outletWord: string
  modules: { missions: boolean; outlets: boolean; orders: boolean; pay: boolean }
  /** Prénom de l'agent qui sert de fil rouge à la journée type. */
  agentName: string
  presenter: string
  meetingDate: string | null
  color: string
  supportEmail: string
  supportPhone: string
}

export interface Presentation {
  id: string
  content: PresentationContent
  tenantId: string | null
  tenantName: string | null
  shareToken: string | null
  sharedAt: string | null
  viewCount: number
  lastViewedAt: string | null
  createdAt: string
  updatedAt: string
  createdByName: string | null
  /** Structure de démonstration créée depuis la présentation */
  demoTenantId: string | null
  demoTenantName: string | null
  demoAdminEmail: string | null
  demoCreatedAt: string | null
}

export interface DemoAccount {
  role: 'admin' | 'team_lead' | 'agent'
  name: string
  email: string
  phone: string | null
  group: string | null
}

/** Lien public d'une présentation partagée. */
export const shareUrl = (token: string) => `${window.location.origin}/presentation/${token}`
