import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { apiAs, loginUi, trackConsoleErrors } from './helpers'

/**
 * Dépannages côté back-office : une demande d'Aminata (camion vide), une part prise et remise
 * par Serge (même équipe), le reste toujours ouvert. Les données passent par l'API, comme l'app.
 */
test('dépannages : demande, part réservée puis remise, reste à trouver', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = trackConsoleErrors(page)
  const stamp = Date.now().toString(36)
  const admin = await apiAs('admin@demo.ci')
  const aminata = await apiAs('agent2@demo.ci')
  const serge = await apiAs('agent3@demo.ci')
  const json = async (res: Awaited<ReturnType<typeof admin.post>>) => {
    expect(res.ok(), await res.text()).toBeTruthy()
    return res.json()
  }
  const meA = (await json(await aminata.get('auth/me'))).user as { id: string }
  const meS = (await json(await serge.get('auth/me'))).user as { id: string }
  const coca = await json(await admin.post('products', { data: { name: `Coca ${stamp}`, own: true, format: '33 cl', unit: 'Bouteille' } }))
  const depot = await json(await admin.post('stock/locations', { data: { kind: 'depot', name: `Dépôt ${stamp}` } }))
  await json(await admin.post('stock/locations', { data: { kind: 'van', name: `Camion A ${stamp}`, agentId: meA.id } }))
  const vanS = await json(await admin.post('stock/locations', { data: { kind: 'van', name: `Camion S ${stamp}`, agentId: meS.id } }))
  await json(await admin.post('stock/receipts', { data: { depotId: depot.id, lines: [{ productId: coca.id, quantity: 100 }] } }))
  const load = await json(
    await admin.post('stock/loads', { data: { depotId: depot.id, vanId: vanS.id, lines: [{ productId: coca.id, quantity: 20 }] } }),
  )
  await json(await serge.post(`stock/movements/${load.id}/confirm`, { data: {} }))

  // Aminata demande 30 bouteilles ; Serge en prend 20 et les remet sur place (code scanné).
  const req = await json(
    await aminata.post('van-sales/transfers', { data: { clientId: randomUUID(), lines: [{ productId: coca.id, quantity: 30 }] } }),
  )
  await json(await serge.post(`van-sales/transfers/${req.id}/accept`, { data: { lines: [{ productId: coca.id, quantity: 20 }] } }))

  await loginUi(page, 'admin@demo.ci')
  await page.goto('/stock/transfers')
  await expect(page.getByRole('heading', { name: 'Dépannages', level: 1 })).toBeVisible()
  const card = page.locator('section').filter({ hasText: `Coca ${stamp}` })
  await expect(card).toContainText('Aminata Diallo')
  await expect(card).toContainText('En recherche')
  await expect(card).toContainText('Réservée')
  await expect(card).toContainText('Serge Gbagbo')
  await expect(card).toContainText('réservé jusqu’à')
  const row = card.getByRole('row').filter({ hasText: `Coca ${stamp}` })
  await expect(row).toContainText('30')
  await expect(row).toContainText('20')

  await json(
    await serge.post('van-sales/transfers/handover', {
      data: { clientId: randomUUID(), token: req.token, lines: [{ productId: coca.id, quantity: 20 }] },
    }),
  )
  await page.reload()
  await expect(card).toContainText('Remise')
  await expect(card).toContainText('a remis 20 × Coca')
  // Reste 10 à trouver.
  await expect(
    card
      .getByRole('row')
      .filter({ hasText: `Coca ${stamp}` })
      .getByRole('cell')
      .last(),
  ).toHaveText('10')

  // Mouvements : le dépannage, d'un camion à l'autre.
  await page.goto('/stock/movements')
  await expect(page.getByText(`Camion S ${stamp} → Camion A ${stamp}`).first()).toBeVisible()

  await json(await aminata.post(`van-sales/transfers/${req.id}/close`))
  expect(errors).toEqual([])
})
