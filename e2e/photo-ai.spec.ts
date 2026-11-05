import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { apiAs, loginUi, trackConsoleErrors } from './helpers'

/**
 * IA photo côté back-office : page « Rayons » et analyse d'une photo dans le détail d'une visite
 * (réponses de l'API simulées : aucune IA n'est branchée en local), photo de référence d'un
 * produit et réglage de l'analyse automatique (API réelle), choix du fournisseur dans la console.
 */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const SA_EMAIL = 'e2e-ia-photo@test.ci'
const SA_PASSWORD = 'Editeur-e2e-2026!'

test('rayons, analyse d’une visite, photo de référence, réglage', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = trackConsoleErrors(page)
  const stamp = Date.now().toString(36)
  const admin = await apiAs('admin@demo.ci')
  const product = await (
    await admin.post('products', { data: { name: `Fanta ${stamp}`, own: true, format: '50 cl', unit: 'Bouteille' } })
  ).json()

  const photoId = '11111111-1111-4111-8111-111111111111'
  const visitId = '22222222-2222-4222-8222-222222222222'
  await page.route('**/api/photo-ai/stats**', (route) =>
    route.fulfill({
      json: {
        analyses: 12,
        outletCount: 5,
        avgScore: 64,
        share: 38,
        weeks: [{ week: '2026-10-26', analyses: 12, avgScore: 64, share: 38 }],
        products: [
          { productId: 'p1', name: 'Coca-Cola', format: '33 cl', own: true, analyses: 12, presence: 75, avgFacings: 4.5, avgPrice: 300 },
        ],
        outlets: [
          {
            outletId: 'o1',
            outletName: 'Boutique Chez Awa',
            analyzedAt: '2026-11-04T10:00:00Z',
            score: 35,
            share: 20,
            missing: ['Sprite 33 cl'],
            photoId,
            submissionId: visitId,
            agent: 'Koffi Yao',
          },
        ],
      },
    }),
  )
  await page.route(`**/api/outlets/visits/${visitId}`, (route) =>
    route.fulfill({
      json: {
        id: visitId,
        formName: 'Visite magasin',
        agent: 'Koffi Yao',
        submittedAt: '2026-11-04T10:00:00Z',
        distance: 12,
        status: 'submitted',
        rejectedReason: null,
        fields: [{ key: 'rayon', label: 'Photo du rayon', type: 'photo', required: false }],
        data: { rayon: photoId },
        photos: {
          [photoId]: {
            id: photoId,
            lat: null,
            lng: null,
            accuracy: null,
            takenAt: '2026-11-04T10:00:00Z',
            kind: 'shelf',
            analysis: 'done',
            shelfScore: 35,
          },
        },
        readings: [],
      },
    }),
  )
  await page.route(`**/api/photos/${photoId}`, (route) => route.fulfill({ body: PNG, contentType: 'image/png' }))
  await page.route(`**/api/photo-ai/photos/${photoId}`, (route) =>
    route.fulfill({
      json: {
        photoId,
        status: 'done',
        skipReason: null,
        skipLabel: null,
        result: {
          products: [
            { productId: 'p1', present: true, facings: 4, price: 300, confidence: 'high' },
            { productId: 'p2', present: false, facings: null, price: null, confidence: 'medium' },
          ],
          others: [{ name: 'Youki', brand: null, facings: 3 }],
          shelfScore: 35,
          notes: 'Sprite absent, rayon peu fourni.',
        },
        products: { p1: { name: 'Coca-Cola', format: '33 cl', own: true }, p2: { name: 'Sprite', format: '33 cl', own: true } },
        provider: 'mistral',
        model: 'mistral-large-4',
        error: null,
        attempts: 1,
        createdAt: '2026-11-04T10:00:00Z',
        analyzedAt: '2026-11-04T10:01:00Z',
      },
    }),
  )

  await loginUi(page, 'admin@demo.ci')

  // Rayons : chiffres, produits, points de vente les plus faibles d'abord.
  await page.goto('/shelves')
  await expect(page.getByRole('heading', { name: 'Rayons', level: 1 })).toBeVisible()
  await expect(page.getByText('38 %').first()).toBeVisible()
  await expect(page.getByText(/photos analysées en novembre/)).toBeVisible()
  const row = page.getByRole('row').filter({ hasText: 'Boutique Chez Awa' })
  await expect(row).toContainText('35 / 100')
  await expect(row).toContainText('Sprite 33 cl')

  // Détail de la visite : analyse de la photo de rayon.
  await row.getByRole('button').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Analyse des rayons par l’IA')).toBeVisible()
  await expect(dialog.getByText('Score du rayon : 35 / 100')).toBeVisible()
  await expect(dialog.getByText('Absent du rayon')).toBeVisible()
  await expect(dialog.getByText('4 faces')).toBeVisible()
  await expect(dialog.getByText(/Youki \(3 faces\)/)).toBeVisible()
  await expect(dialog.getByText(/par Mistral AI/)).toBeVisible()
  await page.keyboard.press('Escape')

  // Photo de référence d'un produit (API réelle).
  await page.goto('/products')
  await page
    .getByRole('row')
    .filter({ hasText: `Fanta ${stamp}` })
    .getByRole('button')
    .last()
    .click()
  await page.getByRole('menuitem', { name: /Modifier/ }).click()
  const edit = page.getByRole('dialog')
  await edit.getByLabel('Photo de référence du produit').setInputFiles({ name: 'fanta.png', mimeType: 'image/png', buffer: PNG })
  await expect(edit.getByRole('img', { name: 'Photo de référence' })).toBeVisible()
  await expect(edit.getByRole('button', { name: 'Changer la photo' })).toBeVisible()
  const saved = ((await (await admin.get('products')).json()) as { id: string; referencePhotoId: string | null }[]).find(
    (p) => p.id === product.id,
  )
  expect(saved?.referencePhotoId).toBeTruthy()
  await edit.getByRole('button', { name: 'Retirer' }).click()
  await expect(edit.getByRole('button', { name: 'Ajouter une photo' })).toBeVisible()
  await page.keyboard.press('Escape')

  // Réglage : analyse automatique et compteur du mois.
  await page.goto('/settings')
  await expect(page.getByText('Analyser automatiquement les photos de rayon')).toBeVisible()
  await expect(page.getByText('Photos analysées ce mois-ci')).toBeVisible()

  await admin.delete(`products/${product.id}`)
  expect(errors).toEqual([])
})

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

test('console : fournisseur de l’IA photo', async ({ page }) => {
  const consoleUrl = consolePath()
  test.skip(!consoleUrl, 'Console éditeur désactivée (VITE_PLATFORM_PATH vide)')
  try {
    execSync(`npm run platform:admin -- ${SA_EMAIL} '${SA_PASSWORD}' Awa IA`, {
      cwd: path.resolve(import.meta.dirname, '../../backend'),
      stdio: 'pipe',
    })
  } catch {
    // Le compte existe déjà.
  }
  await page.route('**/api/platform/photo-ai', (route) =>
    route.fulfill({
      json: {
        choice: 'anthropic',
        providers: [
          { id: 'anthropic', label: 'Anthropic (Claude)', configured: true, model: 'claude-opus-5-5' },
          { id: 'mistral', label: 'Mistral AI', configured: false, model: null },
        ],
        month: '2026-11',
        usage: [{ provider: 'anthropic', analyses: 42, costUsd: 1.68 }],
      },
    }),
  )
  await page.goto(`${consoleUrl}/login`)
  await page.getByLabel('Email').fill(SA_EMAIL)
  await page.getByLabel('Mot de passe').fill(SA_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('link', { name: 'Réglages' }).click()
  const group = page.getByRole('radiogroup', { name: 'Fournisseur de l’IA photo' })
  await expect(group.getByRole('radio', { name: /Anthropic/ })).toHaveAttribute('aria-checked', 'true')
  await expect(group.getByRole('radio', { name: /Mistral AI/ })).toBeDisabled()
  await expect(group.getByText('Clé MISTRAL_API_KEY absente du .env')).toBeVisible()
  await expect(page.getByText('42 photos · 1,68 $')).toBeVisible()
  await group.getByRole('radio', { name: /Désactivée/ }).click()
  await expect(page.getByRole('button', { name: 'Enregistrer' }).last()).toBeEnabled()
})
