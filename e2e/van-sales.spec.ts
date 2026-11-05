import { expect, test } from '@playwright/test'
import { apiAs, loginUi, trackConsoleErrors } from './helpers'

/**
 * Vente en camionnette côté back-office : dépôts et camions, entrée au dépôt saisie en casiers,
 * chargement à confirmer, plafond de crédit d'un client, vente directe (reste à payer, reçu
 * PDF) et remise de caisse. Les données sont créées par l'API, comme le ferait l'app.
 */
test('stock, crédit, vente directe, reçu et caisse', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = trackConsoleErrors(page)
  const stamp = Date.now().toString(36)
  const admin = await apiAs('admin@demo.ci')
  const agent = await apiAs('agent1@demo.ci')
  const json = async (res: Awaited<ReturnType<typeof admin.post>>) => {
    expect(res.ok(), await res.text()).toBeTruthy()
    return res.json()
  }
  const me = (await json(await agent.get('auth/me'))).user as { id: string; firstName: string; lastName: string }

  // Catalogue, prix et un client créé par l'agent.
  const product = await json(
    await admin.post('products', {
      data: { name: `Coca ${stamp}`, own: true, format: '33 cl', unit: 'Bouteille', packagings: [{ name: 'Casier', units: 24 }] },
    }),
  )
  const lists = (await json(await admin.get('orders/price-lists'))) as { id: string; isDefault: boolean }[]
  const list =
    lists.find((l) => l.isDefault) ?? (await json(await admin.post('orders/price-lists', { data: { name: `Détaillant ${stamp}` } })))
  await json(await admin.put('orders/prices', { data: { items: [{ priceListId: list.id, productId: product.id, price: 300 }] } }))
  const outletName = `Boutique e2e ${stamp}`
  const outlet = await json(await agent.post('outlets', { data: { name: outletName, lat: 5.32, lng: -4.02, accuracy: 5, force: true } }))
  await json(await admin.post('stock/locations', { data: { kind: 'depot', name: `Dépôt ${stamp}` } }))
  const van = await json(await admin.post('stock/locations', { data: { kind: 'van', name: `Camion ${stamp}`, agentId: me.id } }))

  await loginUi(page, 'admin@demo.ci')

  // Dépôts et camions : le camion et son agent.
  await page.goto('/stock/locations')
  await expect(page.getByText(`Camion ${stamp}`)).toBeVisible()
  await expect(page.getByText(`Agent : ${me.firstName} ${me.lastName}`).first()).toBeVisible()

  // Entrée au dépôt saisie en casiers : 10 casiers = 240 bouteilles.
  await page.goto('/stock')
  await page.getByRole('button', { name: 'Entrée au dépôt' }).first().click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Dépôt', { exact: true }).click()
  await page.getByRole('option', { name: `Dépôt ${stamp}` }).click()
  await dialog.getByLabel('Produit, ligne 1').click()
  await page.getByRole('option', { name: `Coca ${stamp} 33 cl` }).click()
  await dialog.getByLabel('Quantité, ligne 1').fill('10')
  await dialog.getByLabel('Unité, ligne 1').click()
  await page.getByRole('option', { name: 'Casier (24)' }).click()
  await expect(dialog.getByText('240 bouteilles (10 casiers)')).toBeVisible()
  await dialog.getByRole('button', { name: 'Enregistrer l’entrée' }).click()
  await expect(dialog).toBeHidden()
  const row = page.getByRole('row').filter({ hasText: `Coca ${stamp}` })
  await expect(row).toContainText('240')
  await expect(row).toContainText('10 casiers')

  // Chargement du camion : en attente de l'agent.
  await page.getByRole('button', { name: 'Charger un camion' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Depuis le dépôt').click()
  await page.getByRole('option', { name: `Dépôt ${stamp}` }).click()
  await dialog.getByLabel('Camion').click()
  await page.getByRole('option', { name: new RegExp(`Camion ${stamp}`) }).click()
  await dialog.getByLabel('Produit, ligne 1').click()
  await page.getByRole('option', { name: `Coca ${stamp} 33 cl` }).click()
  await dialog.getByLabel('Quantité, ligne 1').fill('48')
  await dialog.getByRole('button', { name: 'Préparer le chargement' }).click()
  await expect(dialog).toBeHidden()
  const pending = page.getByRole('region', { name: 'À confirmer' })
  await expect(pending).toContainText(`Dépôt ${stamp} → Camion ${stamp}`)
  await expect(pending).toContainText('en attente de l’agent')

  // L'agent confirme sur son téléphone, puis vend à crédit en partie.
  const load = (
    (await json(await admin.get('stock/movements', { params: { status: 'pending', locationId: van.id } }))) as { items: { id: string }[] }
  ).items[0]
  await json(await agent.post(`stock/movements/${load.id}/confirm`, { data: {} }))

  // Plafond de crédit, sur la fiche du point de vente.
  await page.goto('/outlets')
  await page.getByText(outletName).first().click()
  const credit = page.getByRole('region', { name: 'Crédit et paiements' })
  await expect(credit).toContainText('Pas de crédit')
  await credit.getByRole('button', { name: 'Autoriser le crédit…' }).click()
  await credit.getByLabel('Plafond de crédit (FCFA)').fill('10000')
  await credit.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(credit).toContainText('10 000')

  const sale = await json(
    await agent.post('van-sales/sales', {
      data: {
        clientId: crypto.randomUUID(),
        outletId: outlet.id,
        lines: [{ productId: product.id, quantity: 24 }],
        paidAmount: 4000,
        paymentMethod: 'cash',
      },
    }),
  )
  expect(sale).toMatchObject({ kind: 'sale', total: 7200, due: 3200 })

  // Ventes directes : détail, reste à payer, reçu PDF.
  await page.goto('/orders')
  await page.getByLabel('Commandes ou ventes directes').click()
  await page.getByRole('option', { name: 'Ventes directes (camions)' }).click()
  await page.getByRole('button', { name: sale.reference }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByText(`Vente ${sale.reference}`)).toBeVisible()
  await expect(sheet.getByText(`Vente directe depuis Camion ${stamp}`)).toBeVisible()
  await expect(sheet.getByRole('row', { name: /Reste à payer/ })).toContainText('3 200')
  const download = page.waitForEvent('download')
  await sheet.getByRole('button', { name: 'Télécharger le reçu (PDF)' }).click()
  expect((await download).suggestedFilename()).toBe(`recu-${sale.reference}.pdf`)
  await page.keyboard.press('Escape')

  // Caisse : 4 000 F en espèces à remettre ; le responsable les reçoit.
  await page.goto('/cash')
  const agentRow = page.getByRole('row').filter({ hasText: `Camion ${stamp}` })
  await expect(agentRow).toContainText('4 000')
  await agentRow.getByRole('button', { name: 'Recevoir' }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Montant reçu (FCFA)')).toHaveValue('4000')
  await dialog.getByRole('button', { name: 'Enregistrer la remise' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Remises du jour' })).toBeVisible()
  await expect(agentRow.getByRole('button', { name: 'Recevoir' })).toBeHidden()

  expect(errors).toEqual([])
  await admin.dispose()
  await agent.dispose()
})
