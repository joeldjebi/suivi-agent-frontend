import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, request, test, type Page } from '@playwright/test'
import { loginUi, trackConsoleErrors } from './helpers'

/**
 * Grille tarifaire de novembre 2026 : prix par camion actif et forfaits de mise en place réglés
 * dans la console, frais ajoutés à une structure, détail du mois dans la page Abonnement, options
 * et mise en place sur le site.
 */
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

async function loginConsole(page: Page, base: string) {
  await page.goto(`${base}/login`)
  await page.getByLabel('Email').fill('sa@suivi.ci')
  await page.getByLabel('Mot de passe').fill('Password123!')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

test('console : prix par camion, forfaits de mise en place, frais d’une structure', async ({ page }) => {
  const base = consolePath()
  test.skip(!base, 'Console éditeur désactivée (VITE_PLATFORM_PATH vide)')
  const errors = trackConsoleErrors(page)
  // Une structure toute neuve, en essai.
  const stamp = Date.now().toString(36)
  const name = `Grille ${stamp}`
  const api = await request.newContext({ baseURL: 'http://localhost:3000/api/' })
  const reg = await api.post('auth/register', {
    data: { organizationName: name, firstName: 'Awa', lastName: 'Grille', email: `grille-${stamp}@test.ci`, password: 'Password123!' },
  })
  expect(reg.ok(), await reg.text()).toBeTruthy()
  const token = ((await reg.json()) as { accessToken: string }).accessToken
  const me = (await (await api.get('auth/me', { headers: { Authorization: `Bearer ${token}` } })).json()) as {
    user: { tenantId: string }
  }

  await loginConsole(page, base!)
  // Formules : la vente en camion a son prix par camion actif.
  await page.getByRole('link', { name: 'Formules' }).click()
  await expect(page.getByText('3 000 F CFA / camion actif')).toBeVisible()
  await page.getByRole('button', { name: 'Modifier la formule Entreprise' }).click()
  await expect(page.getByRole('dialog').getByLabel('Prix d’un camion actif par mois (FCFA)')).toHaveValue('3000')
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click()

  // Réglages : les forfaits de mise en place.
  await page.getByRole('link', { name: 'Réglages' }).click()
  await expect(page.getByRole('heading', { name: 'Mise en place' })).toBeVisible()
  await expect(page.getByLabel('Nom').first()).toHaveValue('Démarrage')

  // Fiche de la structure : un forfait ajouté à la prochaine facture, puis retiré.
  await page.goto(`${base}/tenants/${me.user.tenantId}?tab=billing`)
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Montant (FCFA)')).toHaveValue('50000')
  await dialog.getByRole('button', { name: 'Ajouter' }).click()
  await expect(page.getByText('Frais ajoutés à la prochaine facture')).toBeVisible()
  await expect(page.getByText(/prochaine facture/).first()).toBeVisible()
  // L'estimation du mois les compte déjà.
  await expect(page.getByRole('cell', { name: 'Mise en place : Démarrage' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Retirer Mise en place : Démarrage' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Retirer' }).click()
  await expect(page.getByText('Frais retirés')).toBeVisible()
  await expect(page.getByText('Aucun frais.', { exact: false })).toBeVisible()
  expect(errors).toEqual([])
})

test('structure : options des formules, mise en place et détail du mois', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  // Structure de démo, déjà configurée (une structure neuve voit d'abord l'assistant de démarrage).
  await loginUi(page, 'admin@demo.ci')
  await page.goto('/subscription')
  await expect(page.getByRole('heading', { name: 'Abonnement' })).toBeVisible()
  await expect(page.getByText('par camion actif dans le mois')).toBeVisible()
  await expect(page.getByText(/200 photos/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mise en place (en option)' })).toBeVisible()
  await expect(page.getByText('Démarrage')).toBeVisible()
  await page.getByRole('button', { name: 'Voir le détail' }).click()
  const detail = page.getByRole('dialog')
  await expect(detail.getByRole('rowheader', { name: 'Estimation' })).toBeVisible()
  await expect(detail.getByText(/^Formule /)).toBeVisible()
  expect(errors).toEqual([])
})

test('site : options des formules et mise en place', async ({ page }) => {
  await page.goto('/')
  await page.locator('#tarifs').scrollIntoViewIfNeeded()
  await expect(page.getByText(/par camion actif dans le mois/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mise en place, en option' })).toBeVisible()
  await expect(page.getByText('Accompagné')).toBeVisible()
})
