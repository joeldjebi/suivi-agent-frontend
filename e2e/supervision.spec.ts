import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { trackConsoleErrors } from './helpers'

/**
 * Supervision de la console éditeur : état interne de PerformX, puis la synthèse des outils
 * de suivi (UptimeRobot, Sentry, Netdata), simulée ici pour ne dépendre d'aucun compte.
 */
const EMAIL = 'e2e-supervision@test.ci'
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
    execSync(`npm run platform:admin -- ${EMAIL} '${PASSWORD}' Awa Supervision`, {
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
  await page.getByRole('link', { name: 'Supervision' }).click()
  await expect(page.getByRole('heading', { name: 'Supervision', level: 1 })).toBeVisible()
}

test('sans outil relié : état interne et marche à suivre pour chaque outil', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await open(page)
  await expect(page.getByText('En service')).toBeVisible()
  await expect(page.getByText('UptimeRobot n’est pas relié.', { exact: false })).toBeVisible()
  await expect(page.getByText('Sentry n’est pas relié.', { exact: false })).toBeVisible()
  await expect(page.getByText('Netdata n’est pas relié.', { exact: false })).toBeVisible()
  await expect(page.getByText('Base de données')).toBeVisible()

  // « Actualiser » relit tout sans erreur.
  const refresh = page.waitForResponse((r) => r.url().includes('/platform/supervision?refresh=1'))
  await page.getByRole('button', { name: 'Actualiser' }).click()
  expect((await refresh).status()).toBe(200)
  expect(errors).toEqual([])
})

test('outils reliés : disponibilité, erreurs, serveur et alertes en tête', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await page.route('**/api/platform/supervision**', (route) =>
    route.fulfill({
      json: {
        generatedAt: new Date().toISOString(),
        performx: {
          health: { status: 'ok', database: 'up', postgis: '3.4.2', redis: 'up' },
          apiUptimeS: 93_600,
          apiMemoryMb: 182.4,
          databaseMb: 1843.2,
          databaseConnections: 12,
          redisMemoryMb: 3.1,
          activeDays: 47,
          positionsLastHour: 5640,
          errorLog: { open: 0, lastDay: 0 },
        },
        availability: {
          configured: true,
          monitors: [
            {
              name: 'performx.online',
              url: 'https://performx.online/',
              status: 'up',
              uptime: { day: 100, week: 99.98, month: 99.95 },
              responseMs: 212,
              incidents: [{ at: '2026-10-12T03:10:00Z', durationS: 300 }],
            },
            {
              name: 'API',
              url: 'https://performx.online/api/health',
              status: 'down',
              uptime: { day: 97.2, week: 99.6, month: 99.8 },
              responseMs: 340,
              incidents: [],
            },
          ],
        },
        errors: {
          configured: true,
          url: 'https://performx-sl.sentry.io/issues/',
          unresolved: 3,
          projects: [
            { slug: 'performx-api', name: 'performx-api', unresolved: 1 },
            { slug: 'performx-web', name: 'performx-web', unresolved: 2 },
          ],
          perDay: ['15', '16', '17', '18', '19', '20', '21'].map((j, i) => ({ date: `2026-10-${j}`, count: [0, 2, 1, 0, 0, 4, 1][i] })),
          top: [
            {
              title: 'TypeError: Cannot read properties of undefined (reading "lat")',
              project: 'performx-web',
              count: 14,
              users: 3,
              lastSeen: new Date().toISOString(),
              level: 'error',
              link: 'https://performx-sl.sentry.io/issues/1/',
            },
          ],
        },
        server: { configured: true, error: 'fetch failed' },
      },
    }),
  )
  await open(page)

  const status = page.getByRole('status').filter({ hasText: 'injoignable' })
  await expect(status).toContainText('API est injoignable.')
  await expect(status).toContainText('Netdata n’a pas pu être lu.')

  await expect(page.getByText('performx.online', { exact: true })).toBeVisible()
  await expect(page.getByText('97,2 %')).toBeVisible()
  await expect(page.getByText('Lecture de Netdata impossible : fetch failed')).toBeVisible()
  await expect(page.getByRole('link', { name: /TypeError: Cannot read/ })).toHaveAttribute(
    'href',
    'https://performx-sl.sentry.io/issues/1/',
  )
  await expect(page.getByRole('button', { name: 'Ouvrir Sentry' })).toBeVisible()
  await expect(page.getByText('1,8 Go')).toBeVisible()
  expect(errors).toEqual([])
})
