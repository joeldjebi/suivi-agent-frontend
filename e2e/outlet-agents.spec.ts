import { expect, test } from '@playwright/test'
import { apiAs, loginUi, trackConsoleErrors } from './helpers'

/**
 * Points de vente confiés à un agent : filtre par responsable, transfert depuis la fiche
 * (historisé), et liste mise à jour en direct quand un autre responsable transfère.
 */
test('points de vente : agent responsable, transfert historisé, mise à jour en direct', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = trackConsoleErrors(page)
  const stamp = Date.now().toString(36)
  const admin = await apiAs('admin@demo.ci')
  const json = async (res: Awaited<ReturnType<typeof admin.post>>) => {
    expect(res.ok(), await res.text()).toBeTruthy()
    return res.json()
  }
  const meA = (await json(await (await apiAs('agent2@demo.ci')).get('auth/me'))).user as { id: string }
  const meS = (await json(await (await apiAs('agent3@demo.ci')).get('auth/me'))).user as { id: string }
  const shop = await json(
    await admin.post('outlets', { data: { name: `Boutique ${stamp}`, lat: 5.3201, lng: -4.0201, force: true, agentId: meA.id } }),
  )
  const kiosk = await json(
    await admin.post('outlets', { data: { name: `Kiosque ${stamp}`, lat: 5.3203, lng: -4.0203, force: true, agentId: meA.id } }),
  )

  const row = (name: string) => page.getByRole('listitem').filter({ hasText: name }).getByRole('button')

  await loginUi(page, 'admin@demo.ci')
  await page.goto('/outlets')
  await page.getByRole('combobox', { name: 'Agent responsable' }).click()
  await page.getByRole('option', { name: 'Aminata Diallo' }).click()
  await page.getByLabel('Rechercher un point de vente').fill(stamp)
  await expect(row(`Boutique ${stamp}`)).toContainText('Aminata Diallo')

  // Transfert depuis la fiche, avec un motif : la fiche et son historique suivent.
  await row(`Boutique ${stamp}`).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByText('Agent responsable')).toBeVisible()
  await sheet.getByRole('button', { name: 'Transférer' }).click()
  const dialog = page.getByRole('dialog', { name: /Transférer/ })
  await dialog.getByRole('combobox', { name: 'Nouveau responsable' }).click()
  await page.getByRole('option', { name: 'Serge Gbagbo' }).click()
  await dialog.getByRole('textbox', { name: 'Motif (facultatif)' }).fill('Réorganisation des tournées')
  await dialog.getByRole('button', { name: 'Transférer' }).click()
  await expect(page.getByText('1 point de vente transféré')).toBeVisible()
  const history = page.getByRole('list', { name: 'Historique des responsables' })
  await expect(history).toContainText('Aminata Diallo')
  await expect(history).toContainText('Serge Gbagbo')
  await expect(history).toContainText('« Réorganisation des tournées »')
  await expect(history).toContainText('par ')
  await page.keyboard.press('Escape')

  // Filtre « Aminata » : la boutique disparaît ; le kiosque transféré ailleurs (autre onglet,
  // autre responsable) disparaît aussi, sans recharger la page.
  await expect(row(`Boutique ${stamp}`)).toHaveCount(0)
  await expect(row(`Kiosque ${stamp}`)).toBeVisible()
  await json(await admin.post('outlets/assign', { data: { outletIds: [kiosk.id], agentId: meS.id } }))
  await expect(row(`Kiosque ${stamp}`)).toHaveCount(0, { timeout: 10_000 })

  await json(await admin.post('outlets/assign', { data: { outletIds: [shop.id, kiosk.id], agentId: null } }))
  expect(errors).toEqual([])
})
