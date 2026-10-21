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

/** Réponse simulée des trois outils reliés. */
const outils = () => ({
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
    activity: null as { at: string; positions: number; agents: number }[] | null,
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
        history: [] as { at: string; ms: number }[],
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
  server: { configured: true, error: 'fetch failed' } as Record<string, unknown>,
})

test('sans outil relié : état interne et marche à suivre pour chaque outil', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await open(page)
  await expect(page.getByText('En service')).toBeVisible()
  // Le mode d'emploi s'ouvre à la première visite et se replie.
  const guide = page.getByRole('button', { name: /Comment lire cette page/ })
  await expect(guide).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('heading', { name: 'Journal interne ou Sentry ?' })).toBeVisible()
  await guide.click()
  await expect(page.getByRole('heading', { name: 'Journal interne ou Sentry ?' })).toBeHidden()
  await expect(page.getByText('UptimeRobot n’est pas relié.', { exact: false })).toBeVisible()
  await expect(page.getByText('Sentry n’est pas relié.', { exact: false })).toBeVisible()
  await expect(page.getByText('Netdata n’est pas relié.', { exact: false })).toBeVisible()
  await expect(page.getByText('Base de données', { exact: true })).toBeVisible()

  // « Actualiser » relit tout sans erreur.
  const refresh = page.waitForResponse((r) => r.url().includes('/platform/supervision?refresh=1'))
  await page.getByRole('button', { name: 'Actualiser' }).click()
  expect((await refresh).status()).toBe(200)
  expect(errors).toEqual([])
})

test('outils reliés : disponibilité, erreurs, serveur et alertes en tête', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await page.route('**/api/platform/supervision**', (route) => route.fulfill({ json: outils() }))
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

test('historiques : activité, temps de réponse et serveur sur 24 heures', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  const heure = (i: number) => new Date(Date.now() - (23 - i) * 3_600_000).toISOString()
  const data = outils()
  data.performx.activity = Array.from({ length: 24 }, (_, i) => ({ at: heure(i), positions: i * 40, agents: Math.min(i, 12) }))
  data.availability.monitors[0].history = Array.from({ length: 24 }, (_, i) => ({ at: heure(i), ms: 180 + (i % 5) * 20 }))
  data.server = {
    configured: true,
    cpu: 0.9,
    ram: { usedPct: 4.5, totalMb: 96563 },
    disk: { usedPct: 11.3, totalGb: 697.6, availGb: 618.5 },
    load: { one: 0.3, five: 0.2, fifteen: 0.2 },
    uptimeS: 122_400,
    cores: 24,
    history: Array.from({ length: 48 }, (_, i) => ({ at: heure(i / 2), cpu: 1 + (i % 7), ram: 4.5 })),
  }
  await page.route('**/api/platform/supervision**', (route) => route.fulfill({ json: data }))
  await open(page)
  await expect(page.getByRole('heading', { name: 'Activité des dernières 24 heures' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Graphique : Positions reçues' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Graphique : Agents actifs' })).toBeVisible()
  await expect(page.getByRole('img', { name: /temps de réponse de performx.online sur 24 heures/ })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Graphique : processeur et mémoire du serveur sur 24 heures' })).toBeVisible()
  await expect(page.getByText('0,3 pour 24 cœurs')).toBeVisible()
  expect(errors).toEqual([])
})
