import { expect, test } from '@playwright/test'
import { loginUi, trackConsoleErrors } from './helpers'

/**
 * Écrans sans test dédié : chacun s'ouvre (titre affiché, aucune erreur) ; pages publiques ;
 * session partagée entre onglets.
 */
test.describe('Écrans de la structure', () => {
  test('commandes, points de vente, produits, prix, paie, notifications, support, apparence, réponses, démarrage', async ({ page }) => {
    const errors = trackConsoleErrors(page)
    await loginUi(page, 'admin@demo.ci')
    const screens: [string, string | null][] = [
      ['/orders', 'Commandes'],
      ['/outlets', 'Points de vente'],
      ['/products', 'Produits'],
      ['/prices', null],
      ['/pay', 'Rémunération'],
      ['/broadcasts', 'Notifications aux équipes'],
      ['/support', 'Support'],
      ['/branding', 'Application mobile'],
      ['/form-stats', 'Réponses aux formulaires'],
      ['/setup', null],
    ]
    for (const [path, title] of screens) {
      await page.goto(path)
      const heading = title ? page.getByRole('heading', { name: title, exact: true }) : page.getByRole('heading', { level: 1 }).first()
      await expect(heading, path).toBeVisible()
      // Jamais l'écran d'erreur de la page.
      await expect(page.getByText(/Cette page (a rencontré un problème|n’a pas pu être chargée)/), path).toHaveCount(0)
    }
    expect(errors).toEqual([])
  })
})

test.describe('Pages publiques', () => {
  test('site vitrine, téléchargement, assistance et pages légales', async ({ page }) => {
    const errors = trackConsoleErrors(page)
    const pages: [string, string][] = [
      ['/telecharger', 'Télécharger l’app'],
      ['/assistance', 'Assistance'],
      ['/confidentialite', 'Politique de confidentialité'],
      ['/suppression-compte', 'Suppression de compte'],
    ]
    for (const [path, title] of pages) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: title, level: 1 }), path).toBeVisible()
    }
    // Les liens du pied de page mènent à ces pages.
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Télécharger l’app' })).toHaveAttribute('href', '/telecharger')
    await expect(page.getByRole('link', { name: 'Politique de confidentialité' })).toHaveAttribute('href', '/confidentialite')
    // Section « Téléchargez PerformX » : APK Android, app web pour l'iPhone, lien du menu.
    const download = page.locator('#telecharger')
    await expect(download.getByRole('heading', { name: 'Téléchargez PerformX.' })).toBeVisible()
    await expect(download.getByRole('link', { name: 'Télécharger pour Android' })).toHaveAttribute('href', /\.apk$/)
    await expect(download.getByRole('link', { name: 'Ouvrir l’app web' })).toHaveAttribute('href', /^https:\/\/app\./)
    await expect(page.getByRole('navigation', { name: 'Navigation du site' }).getByRole('link', { name: 'Télécharger' })).toHaveAttribute(
      'href',
      '#telecharger',
    )
    expect(errors).toEqual([])
  })

  test('référencement : robots.txt, plan du site et aperçu de partage', async ({ page, request }) => {
    expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap: https://performx.online/sitemap.xml')
    expect(await (await request.get('/sitemap.xml')).text()).toContain('https://performx.online/telecharger')
    await page.goto('/')
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-image\.jpg$/)
  })
})

test.describe('Session', () => {
  test('se déconnecter dans un onglet ferme aussi les autres', async ({ context }) => {
    const first = await context.newPage()
    await loginUi(first, 'admin@demo.ci')
    const second = await context.newPage()
    await second.goto('/users')
    await expect(second.getByRole('heading', { name: 'Agents et comptes', exact: true })).toBeVisible()

    await first.getByRole('button', { name: 'Menu du compte' }).click()
    await first.getByRole('menuitem', { name: 'Se déconnecter' }).click()
    await expect(first).toHaveURL(/\/login/)
    await expect(second).toHaveURL(/\/login/)
  })
})
