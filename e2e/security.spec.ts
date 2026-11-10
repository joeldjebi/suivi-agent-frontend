import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { trackConsoleErrors } from './helpers'

/** Journal de sécurité de la console éditeur : la page s'affiche sans erreur. */
const EMAIL = 'e2e-security@test.ci'
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
    execSync(`npm run platform:admin -- ${EMAIL} '${PASSWORD}' Awa Securite`, {
      cwd: path.resolve(import.meta.dirname, '../../backend'),
      stdio: 'pipe',
    })
  } catch {
    // Le compte existe déjà.
  }
})

async function open(page: Page) {
  const consoleUrl = consolePath()
  test.skip(!consoleUrl, 'Console éditeur désactivée (VITE_PLATFORM_PATH vide)')
  await page.goto(`${consoleUrl}/login`)
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Mot de passe').fill(PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('link', { name: 'Sécurité' }).click()
  await expect(page.getByRole('heading', { name: 'Sécurité', level: 1 })).toBeVisible()
}

test('la page Sécurité s’affiche avec ses compteurs et son graphe', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await open(page)
  await expect(page.getByText('Attaques (24 h)')).toBeVisible()
  await expect(page.getByText('Mot de passe refusé')).toBeVisible()
  await expect(page.getByText('Attaques par jour (14 jours)')).toBeVisible()
  await expect(page.getByText('Dernières attaques')).toBeVisible()
  // L'onglet « Attaquants » s'affiche aussi.
  await page.getByRole('tab', { name: 'Attaquants (par IP)' }).click()
  await expect(page.getByText('Attaquants des 7 derniers jours')).toBeVisible()
  expect(errors).toEqual([])
})
