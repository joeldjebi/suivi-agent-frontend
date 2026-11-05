import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, request, test, type Page } from '@playwright/test'
import { trackConsoleErrors } from './helpers'

/**
 * Console éditeur : suppression définitive d'une structure, réservée au compte propriétaire
 * (sa@suivi.ci dans la démo), confirmée par le nom de la structure et le mot de passe.
 */
const SIMPLE = 'e2e-suppression@test.ci'
const SIMPLE_PASSWORD = 'Editeur-e2e-2026!'

function consolePath(): string | null {
  for (const file of ['.env.local', '.env']) {
    try {
      const value = readFileSync(path.resolve(import.meta.dirname, '..', file), 'utf8')
        .match(/^VITE_PLATFORM_PATH=(.*)$/m)?.[1]
        ?.trim()
      if (value) return value
    } catch {
      // fichier absent
    }
  }
  return null
}

async function login(page: Page, base: string, email: string, password: string) {
  await page.goto(`${base}/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

test('suppression définitive : propriétaire seul, nom et mot de passe', async ({ page, browser }) => {
  const base = consolePath()
  test.skip(!base, 'Console éditeur désactivée (VITE_PLATFORM_PATH vide)')
  try {
    execSync(`npm run platform:admin -- ${SIMPLE} '${SIMPLE_PASSWORD}' Awa Simple`, {
      cwd: path.resolve(import.meta.dirname, '../../backend'),
      stdio: 'pipe',
    })
  } catch {
    // Le compte existe déjà.
  }
  const errors = trackConsoleErrors(page)
  const stamp = Date.now().toString(36)
  const name = `Structure à supprimer ${stamp}`
  const email = `suppr-${stamp}@test.ci`
  const api = await request.newContext({ baseURL: 'http://localhost:3000/api/' })
  const reg = await api.post('auth/register', {
    data: { organizationName: name, firstName: 'Awa', lastName: 'Test', email, password: 'Password123!' },
  })
  expect(reg.ok(), await reg.text()).toBeTruthy()
  const token = ((await reg.json()) as { accessToken: string }).accessToken
  const me = (await (await api.get('auth/me', { headers: { Authorization: `Bearer ${token}` } })).json()) as {
    user: { tenantId: string }
  }
  const tenantUrl = `${base}/tenants/${me.user.tenantId}`

  // Un compte éditeur qui n'est pas propriétaire ne voit pas le bouton.
  const other = await browser.newPage()
  await login(other, base!, SIMPLE, SIMPLE_PASSWORD)
  await other.goto(tenantUrl)
  await expect(other.getByRole('heading', { name, level: 1 })).toBeVisible()
  await expect(other.getByRole('button', { name: /Supprimer définitivement/ })).toHaveCount(0)
  await other.close()

  // Le propriétaire : nom exact et mot de passe demandés.
  await login(page, base!, 'sa@suivi.ci', 'Password123!')
  await page.goto(tenantUrl)
  await page.getByRole('button', { name: /Supprimer définitivement/ }).click()
  const dialog = page.getByRole('dialog')
  const confirm = dialog.getByRole('button', { name: 'Supprimer définitivement' })
  await expect(confirm).toBeDisabled()
  await dialog.getByLabel(/Tapez le nom de la structure/).fill('pas le bon nom')
  await dialog.getByLabel('Votre mot de passe').fill('Password123!')
  await expect(confirm).toBeDisabled()
  await dialog.getByLabel(/Tapez le nom de la structure/).fill(name)
  // Mauvais mot de passe : refusé, rien n'est supprimé.
  await dialog.getByLabel('Votre mot de passe').fill('mauvais-mot-de-passe')
  await confirm.click()
  await expect(page.getByText('Mot de passe incorrect')).toBeVisible()
  await dialog.getByLabel('Votre mot de passe').fill('Password123!')
  await confirm.click()
  await expect(page.getByText(`« ${name} » supprimée`)).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`${base}/tenants$`))

  // Le compte de la structure ne se connecte plus.
  const relog = await api.post('auth/login', { data: { email, password: 'Password123!' } })
  expect(relog.status()).toBe(401)
  expect(errors.filter((e) => !/40[0-4]/.test(e))).toEqual([])
})
