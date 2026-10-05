/**
 * Adresse secrète de la console éditeur (VITE_PLATFORM_PATH). Sans elle, ou si elle est trop
 * courte pour ne pas être devinée, la console n'existe pas sur ce déploiement.
 */
const raw = (import.meta.env.VITE_PLATFORM_PATH as string | undefined)?.trim().replace(/\/+$/, '') ?? ''

export const PLATFORM_PATH = /^\/[A-Za-z0-9_-]{8,}$/.test(raw) ? raw : null

/** Lien interne à la console : to('/tenants') → '/console-xxxx/tenants'. */
export const to = (path = '') => `${PLATFORM_PATH ?? ''}${path}`
