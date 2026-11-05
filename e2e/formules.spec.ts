import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, request, test } from '@playwright/test'
import { API, trackConsoleErrors } from './helpers'

/**
 * Formules de la console éditeur : les fonctionnalités qui en demandent d'autres (vente en
 * camionnette, IA photo) cochent leurs prérequis, et l'IA photo a son quota mensuel.
 */
const EMAIL = 'e2e-formules@test.ci'
const PASSWORD = 'Editeur-e2e-2026!'

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
    execSync(`npm run platform:admin -- ${EMAIL} '${PASSWORD}' Awa Formules`, {
      cwd: path.resolve(import.meta.dirname, '../../backend'),
      stdio: 'pipe',
    })
  } catch {
    // Le compte existe déjà.
  }
})

test('prérequis cochés automatiquement, quota IA photo enregistré', async ({ page }) => {
  const consoleUrl = consolePath()
  test.skip(!consoleUrl, 'Console éditeur désactivée (VITE_PLATFORM_PATH vide)')
  const errors = trackConsoleErrors(page)
  const code = `e2e-${Date.now().toString(36)}`

  await page.goto(`${consoleUrl}/login`)
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Mot de passe').fill(PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('link', { name: 'Formules' }).click()
  await page.getByRole('button', { name: 'Nouvelle formule' }).first().click()

  const dialog = page.getByRole('dialog')
  const box = (label: RegExp) => dialog.getByRole('checkbox', { name: label })
  const vente = box(/^Vente en camionnette/)
  const commande = box(/^Prise de commande/)
  const points = box(/^Points de vente/)
  const ia = box(/^IA photo/)
  const releves = box(/^Relevés produits/)

  // Cocher la vente en camionnette coche la prise de commande et les points de vente.
  await vente.click()
  await expect(commande).toBeChecked()
  await expect(points).toBeChecked()
  // Décocher la prise de commande décoche ce qui en dépend.
  await commande.click()
  await expect(vente).not.toBeChecked()
  await expect(points).toBeChecked()

  // IA photo : coche les relevés produits et affiche le quota.
  await expect(dialog.getByLabel('Photos analysées incluses par mois')).toBeHidden()
  await ia.click()
  await expect(releves).toBeChecked()
  await expect(dialog.getByText('Avec 0, aucune photo n’est analysée', { exact: false })).toBeVisible()
  await dialog.getByLabel('Photos analysées incluses par mois').fill('300')
  await dialog.getByLabel('Prix de 100 photos en plus (FCFA)').fill('2500')
  await vente.click()

  await dialog.getByLabel('Nom').fill('Formule e2e modules')
  await dialog.getByLabel('Code').fill(code)
  await dialog.getByLabel('Forfait mensuel (FCFA)').fill('50000')
  await dialog.getByLabel('Prix d’un agent supplémentaire').fill('3000')
  await dialog.getByLabel('Agents inclus').fill('10')
  await dialog.getByLabel('Chefs d’équipe inclus').fill('2')
  await dialog.getByRole('button', { name: 'Créer la formule' }).click()
  await expect(dialog).toBeHidden()

  // La carte de la formule affiche le quota et les deux modules.
  const card = page.locator('section').filter({ hasText: 'Formule e2e modules' })
  await expect(card.getByText('300 photos / mois')).toBeVisible()
  await expect(card.getByText(/2\s500\s?F\s?CFA les 100 en plus/)).toBeVisible()
  await expect(card.getByText(/^Vente en camionnette/)).toBeVisible()
  expect(errors).toEqual([])

  // Nettoyage : formule retirée par l'API de la console.
  const api = await request.newContext()
  const login = await api.post(`${API}/platform/auth/login`, { data: { email: EMAIL, password: PASSWORD } })
  const token = (await login.json()).accessToken as string
  await api.delete(`${API}/platform/plans/${code}`, { headers: { Authorization: `Bearer ${token}` } })
})
