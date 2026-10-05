import { expect, request, type APIRequestContext, type Page } from '@playwright/test'

export const PASSWORD = 'Password123!'
export const API = 'http://localhost:3000/api'

/** Connexion par l'interface. */
export async function loginUi(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email ou téléphone').fill(email)
  await page.getByLabel('Mot de passe').fill(PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  // La session est enregistrée une fois la redirection faite.
  await expect(page).not.toHaveURL(/\/login/)
}

/** Client API authentifié, pour simuler l'app mobile d'un agent. */
export async function apiAs(email: string): Promise<APIRequestContext> {
  const anonymous = await request.newContext({ baseURL: `${API}/` })
  const res = await anonymous.post('auth/login', { data: { email, password: PASSWORD } })
  expect(res.ok()).toBeTruthy()
  const { accessToken } = (await res.json()) as { accessToken: string }
  await anonymous.dispose()
  return request.newContext({ baseURL: `${API}/`, extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` } })
}

/** Échoue si la page a émis une erreur JavaScript ou une erreur console. */
export function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (msg) => {
    // Les requêtes refusées attendues (401/403/409) sont journalisées par le navigateur.
    if (msg.type() === 'error' && !/status of (401|403|404|409)/.test(msg.text())) errors.push(msg.text())
  })
  return errors
}
