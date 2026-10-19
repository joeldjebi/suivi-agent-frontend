import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, request, test } from '@playwright/test'
import { API, trackConsoleErrors } from './helpers'

/**
 * Présentations clients : création depuis la console éditeur, aperçu, plein écran,
 * lien de partage ouvert sans compte (sans le déroulé ni les notes), retrait du lien.
 */
const EMAIL = 'e2e-presentations@test.ci'
const PASSWORD = 'Editeur-e2e-2026!'

/** Adresse secrète de la console, lue comme le fait Vite (.env.local puis .env). */
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

test.beforeAll(() => {
  try {
    execSync(`npm run platform:admin -- ${EMAIL} '${PASSWORD}' Awa Démo`, {
      cwd: path.resolve(import.meta.dirname, '../../backend'),
      stdio: 'pipe',
    })
  } catch {
    // Le compte existe déjà.
  }
})

test('console : créer, personnaliser, partager ; le client ouvre le lien sans compte', async ({ page, context }) => {
  const consoleUrl = consolePath()
  test.skip(!consoleUrl, 'Console éditeur désactivée (VITE_PLATFORM_PATH vide)')
  const errors = trackConsoleErrors(page)

  await page.goto(`${consoleUrl}/login`)
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Mot de passe').fill(PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('link', { name: 'Présentations' }).click()
  await expect(page.getByRole('heading', { name: 'Présentations clients' })).toBeVisible()

  // Nouveau prospect : le nom suffit, le reste vient des valeurs par défaut.
  const client = `Moyoo Pro ${Date.now()}`
  await page.getByRole('button', { name: 'Nouvelle présentation' }).first().click()
  await page.getByLabel('Nom du client').fill(client)
  await page.getByRole('button', { name: 'Créer' }).click()
  await expect(page.getByLabel('Nom du client')).toHaveValue(client)

  // L'aperçu suit le formulaire en direct ; une fonction décochée retire ses diapositives.
  await page.getByLabel('Prénom de l’agent d’exemple').fill('Moussa')
  await expect(page.getByRole('heading', { name: 'Suivons Moussa, du matin au soir.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'La commande est prise' })).toHaveCount(1)
  await page.getByRole('switch').nth(2).click()
  await expect(page.getByRole('heading', { name: 'La commande est prise' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()

  // Structure de démo en un clic : comptes et mot de passe montrés une fois.
  await page.getByRole('button', { name: 'Créer la structure de démo' }).click()
  const accounts = page.getByRole('dialog', { name: 'Comptes de la démo' })
  await expect(accounts.getByText('Mot de passe de tous les comptes')).toBeVisible({ timeout: 20_000 })
  const password = (await accounts.locator('.font-mono.select-all').textContent())!.trim()
  const adminEmail = (await accounts.getByRole('row').nth(1).getByRole('cell').nth(2).textContent())!.trim()
  await expect(accounts.getByRole('cell', { name: 'Moussa Brou' })).toBeVisible()
  await accounts.getByRole('button', { name: 'Fermer' }).first().click()
  await expect(page.getByText(`${client} · Démo`)).toBeVisible()

  // Le responsable de la démo voit son équipe sur la carte en direct.
  const demo = await context.browser()!.newPage({ viewport: { width: 1440, height: 900 } })
  await demo.goto('/login')
  await demo.getByLabel('Email ou téléphone').fill(adminEmail)
  await demo.getByLabel('Mot de passe').fill(password)
  await demo.getByRole('button', { name: 'Se connecter' }).click()
  await expect(demo).not.toHaveURL(/\/login/)
  await demo.goto('/map')
  await expect(demo.getByText('Moussa Brou').first()).toBeVisible()
  if (process.env.DEMO_SHOT) await demo.screenshot({ path: process.env.DEMO_SHOT })
  await demo.close()

  // Plein écran : une diapositive à la fois, notes du présentateur avec N.
  await page.getByRole('button', { name: '▶ Présenter' }).click()
  const stage = page.getByRole('dialog', { name: 'Présentation en plein écran' })
  await expect(stage.getByText('1 / ')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('n')
  await expect(stage.getByText('À dire :')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(stage).toHaveCount(0)

  // Lien de partage, ouvert sans compte.
  await page.getByRole('button', { name: 'Créer le lien de partage' }).click()
  const url = await page.getByLabel('Lien de partage').inputValue()
  const shared = await context.browser()!.newPage()
  await shared.goto(url)
  await expect(shared.getByText(`PerformX × ${client}`).first()).toBeVisible()
  await expect(shared.getByRole('heading', { name: 'Suivons Moussa, du matin au soir.' })).toBeVisible()
  await expect(shared.getByText('Le déroulé de la démonstration')).toHaveCount(0)
  await expect(shared.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  await shared.getByRole('button', { name: '▶ Présenter' }).click()
  await shared.keyboard.press('n')
  await expect(shared.getByText('À dire :')).toHaveCount(0)
  await shared.close()

  // Lien retiré : il ne fonctionne plus.
  await page.getByRole('button', { name: 'Retirer le lien' }).click()
  await expect(page.getByRole('button', { name: 'Créer le lien de partage' })).toBeVisible()
  const anonymous = await request.newContext()
  expect((await anonymous.get(`${API}/public/presentations/${url.split('/').pop()}`)).status()).toBe(404)
  await anonymous.dispose()

  // Suppression de la démo.
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByRole('button', { name: 'Créer la structure de démo' })).toBeVisible()

  expect(errors).toEqual([])
})

test('lien inconnu : message clair', async ({ page }) => {
  await page.goto('/presentation/lien-inconnu')
  await expect(page.getByRole('heading', { name: 'Présentation introuvable' })).toBeVisible()
})
