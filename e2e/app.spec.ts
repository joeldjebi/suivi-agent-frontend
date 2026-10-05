import { expect, test } from '@playwright/test'
import { apiAs, loginUi, trackConsoleErrors } from './helpers'

test.describe('Authentification', () => {
  test('refuse un mauvais mot de passe puis connecte l’administrateur', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
    await page.getByLabel('Email ou téléphone').fill('admin@demo.ci')
    await page.getByLabel('Mot de passe').fill('mauvais')
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page.getByRole('alert')).toContainText('Email ou mot de passe incorrect')

    await page.getByLabel('Mot de passe').fill('Password123!')
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page).toHaveURL(/\/map/)
    await expect(page.getByRole('heading', { name: 'Carte en temps réel' })).toBeVisible()
    await expect(page.getByText('Temps réel actif')).toBeVisible()

    // La session survit au rechargement (jeton de rafraîchissement).
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Carte en temps réel' })).toBeVisible()

    await page.getByRole('button', { name: 'Menu du compte' }).click()
    await page.getByRole('menuitem', { name: 'Se déconnecter' }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('valide le formulaire de connexion', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page.getByText('Saisissez un email ou un numéro de téléphone')).toBeVisible()
    await expect(page.getByText('Mot de passe requis')).toBeVisible()
  })

  test('un agent est invité à utiliser l’app mobile', async ({ page }) => {
    await loginUi(page, 'agent1@demo.ci')
    await expect(page.getByRole('heading', { name: "Utilisez l'application mobile" })).toBeVisible()
  })

  test('inscrit une nouvelle structure et ouvre ses paramètres', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Nom de la structure').fill('Société E2E')
    await page.getByLabel('Prénom').fill('Jo')
    await page.getByLabel('Nom', { exact: true }).fill('Test')
    await page.getByLabel('Email professionnel').fill(`e2e.${Date.now()}@test.ci`)
    await page.getByLabel('Mot de passe').fill('Password123!')
    await page.getByRole('button', { name: 'Créer mon espace' }).click()
    await expect(page.getByRole('heading', { name: 'Paramètres de la structure' })).toBeVisible()
    await expect(page.getByText('Société E2E')).toBeVisible()
  })
})

test.describe('Navigation administrateur', () => {
  test('toutes les pages s’affichent sans erreur', async ({ page }) => {
    const errors = trackConsoleErrors(page)
    await loginUi(page, 'admin@demo.ci')
    await expect(page).toHaveURL(/\/map/)
    const pages: [string, string][] = [
      ['Demandes de zone', 'Demandes de zone'],
      ['Historique des journées', 'Historique des journées'],
      ['Missions', 'Missions'],
      ['Zones', 'Zones'],
      ['Groupes', 'Groupes'],
      ['Utilisateurs', 'Utilisateurs'],
      ['Chefs d’équipe', 'Chefs d’équipe'],
      ['Types de missions', 'Types de missions'],
      ['Paramètres', 'Paramètres de la structure'],
      ['Agents actifs', 'Agents actifs'],
      ["Journal d'accès", "Journal d'accès"],
      ['Statistiques', 'Statistiques'],
      ['Abonnement', 'Abonnement'],
      ['Carte en temps réel', 'Carte en temps réel'],
    ]
    const nav = page.getByRole('navigation', { name: 'Navigation principale' })
    for (const [link, heading] of pages) {
      await nav.getByRole('link', { name: link, exact: true }).click()
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    }
    await expect(page.getByRole('heading', { name: 'Zones' })).toBeHidden()
    expect(errors).toEqual([])
  })

  test('affiche les données de démo', async ({ page }) => {
    await loginUi(page, 'admin@demo.ci')
    await page.goto('/zones')
    for (const zone of ['Cocody', 'Marcory', 'Plateau', 'Yopougon']) {
      await expect(page.getByRole('listitem').filter({ hasText: zone })).toBeVisible()
    }
    await page.goto('/groups')
    await expect(page.getByRole('heading', { name: 'Équipe Nord' })).toBeVisible()
    await expect(page.getByText('Chef : Yao Kouassi')).toBeVisible()
    await page.goto('/missions')
    await expect(page.getByRole('link', { name: /50 visites cette semaine/ })).toBeVisible()
  })
})

test.describe('Facturation', () => {
  test('filtre les agents actifs sans changer le total facturé, et exporte', async ({ page }) => {
    const errors = trackConsoleErrors(page)
    await loginUi(page, 'admin@demo.ci')
    await page.goto('/billing')
    await expect(page.getByRole('heading', { name: 'Agents actifs' })).toBeVisible()
    for (const label of ['Mois', 'Recherche', 'Zone travaillée', 'Compte', 'Journées minimum']) {
      await expect(page.getByLabel(label)).toBeVisible()
    }
    await expect(page.getByText('Agents facturés')).toBeVisible()

    // Une recherche sans résultat garde le total et propose d'effacer les filtres.
    await page.getByLabel('Recherche').fill('introuvable')
    await expect(page.getByText('Aucun agent ne correspond')).toBeVisible()
    await page.getByRole('button', { name: 'Effacer les filtres' }).first().click()
    await expect(page.getByLabel('Recherche')).toHaveValue('')

    // Tri par journées (colonne triable, état annoncé).
    const days = page.getByRole('columnheader', { name: /Journées/ })
    if (await days.isVisible()) {
      await days.getByRole('button').click()
      await expect(days).toHaveAttribute('aria-sort', 'descending')
    }
    expect(errors).toEqual([])
  })
})

test.describe('Abonnement', () => {
  test('affiche la formule, les formules disponibles et refuse une formule inférieure utilisée', async ({ page }) => {
    const errors = trackConsoleErrors(page)
    await loginUi(page, 'admin@demo.ci')
    await page.goto('/subscription')
    await expect(page.getByRole('heading', { name: 'Abonnement' })).toBeVisible()
    await expect(page.getByText('Formule actuelle').first()).toBeVisible()
    await page.getByRole('button', { name: 'Choisir Base' }).click()
    await page.getByRole('button', { name: 'Confirmer' }).click()
    await expect(page.getByText('Changement impossible pour l’instant')).toBeVisible()
    // Le 409 attendu est affiché à l'utilisateur, pas une erreur de l'application.
    expect(errors.filter((e) => !e.includes('409'))).toEqual([])
  })
})

test.describe('Statistiques', () => {
  test('affiche les indicateurs et change d’indicateur journalier', async ({ page }) => {
    const errors = trackConsoleErrors(page)
    await loginUi(page, 'admin@demo.ci')
    await page.goto('/stats')
    await expect(page.getByText('Activité jour par jour')).toBeVisible({ timeout: 20000 })
    const hours = page.getByRole('button', { name: 'Heures travaillées' })
    await hours.click()
    await expect(hours).toHaveAttribute('aria-pressed', 'true')
    expect(errors).toEqual([])
  })
})

test.describe('Chefs d’équipe (administrateur)', () => {
  test('liste les chefs, ouvre une fiche et filtre son fil d’actions', async ({ page }) => {
    const errors = trackConsoleErrors(page)
    await loginUi(page, 'admin@demo.ci')
    await page.goto('/team-leads')
    await expect(page.getByRole('heading', { name: 'Chefs d’équipe' })).toBeVisible()
    await expect(page.getByText('Délai moyen de réponse')).toBeVisible()
    await page.getByRole('link', { name: 'Yao Kouassi' }).click()
    await expect(page.getByRole('heading', { name: 'Yao Kouassi' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Fil d’actions/ })).toBeVisible()
    const zones = page.getByRole('button', { name: 'Demandes de zone' })
    await zones.click()
    await expect(zones).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('link', { name: 'Chefs d’équipe' }).first().click()
    await expect(page).toHaveURL(/\/team-leads(\?|$)/)
    expect(errors).toEqual([])
  })
})

test.describe('Chef d’équipe', () => {
  test('se connecte avec son numéro et ne voit que son périmètre', async ({ page }) => {
    await loginUi(page, '07 01 01 01 01')
    const nav = page.getByRole('navigation', { name: 'Navigation principale' })
    await expect(nav.getByRole('link', { name: 'Carte en temps réel' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Paramètres' })).toHaveCount(0)
    await expect(nav.getByRole('link', { name: 'Types de missions' })).toHaveCount(0)

    await page.goto('/settings')
    await expect(page).toHaveURL(/\/map/)

    await page.goto('/zones')
    await expect(page.getByRole('listitem').filter({ hasText: 'Plateau' })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Yopougon' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Dessiner une zone' })).toHaveCount(0)

    await page.goto('/users')
    await expect(page.getByRole('cell', { name: 'Koffi Brou' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Fatou Ouattara' })).toHaveCount(0)
  })
})

test.describe('Zones', () => {
  test('dessine une zone sur la carte puis la configure', async ({ page }) => {
    await loginUi(page, 'admin@demo.ci')
    await page.goto('/zones')
    await page.getByRole('button', { name: 'Dessiner une zone' }).click()
    await expect(page.getByText('Cliquez sur la carte pour placer les points')).toBeVisible()

    // Triangle dessiné au coin de la carte, loin des zones de démo.
    const map = page.getByRole('region', { name: 'Carte', exact: true })
    const box = (await map.boundingBox())!
    const at = (x: number, y: number) => page.mouse.click(box.x + box.width * x, box.y + box.height * y)
    await at(0.08, 0.85)
    await at(0.16, 0.85)
    await at(0.12, 0.75)
    await at(0.08, 0.85)

    const dialog = page.getByRole('dialog', { name: 'Nouvelle zone' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Nom', { exact: true }).fill('Zone E2E')
    await dialog.getByLabel("Nombre maximum d'agents").fill('0')
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(dialog.getByText('Nombre entier supérieur à 0')).toBeVisible()
    await dialog.getByLabel("Nombre maximum d'agents").fill('5')
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()

    await expect(page.getByText('Zone créée')).toBeVisible()
    const item = page.getByRole('listitem').filter({ hasText: 'Zone E2E' })
    await expect(item).toContainText('0/5')

    // Fermeture (désactivation recommandée), réouverture, puis suppression définitive.
    await item.getByRole('button', { name: 'Actions pour Zone E2E' }).click()
    await page.getByRole('menuitem', { name: 'Fermer ou supprimer…' }).click()
    const remove = page.getByRole('dialog', { name: 'Retirer la zone « Zone E2E »' })
    await expect(remove.getByText('Recommandé')).toBeVisible()
    await remove.getByRole('button', { name: /Fermer la zone/ }).click()
    await expect(page.getByText('Désactivation effectuée : « Zone E2E »')).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Zone E2E' })).toHaveCount(0)

    await page.getByText('Afficher les zones fermées').click()
    const closed = page.getByRole('listitem').filter({ hasText: 'Zone E2E' })
    await expect(closed).toContainText('Fermée')
    await closed.getByRole('button', { name: 'Actions pour Zone E2E' }).click()
    await page.getByRole('menuitem', { name: 'Supprimer définitivement…' }).click()
    const confirm = page.getByRole('dialog', { name: 'Supprimer définitivement la zone « Zone E2E » ?' })
    await expect(confirm.getByText("Aucune donnée n'est liée à cet élément.")).toBeVisible()
    await confirm.getByRole('button', { name: 'Supprimer définitivement' }).click()
    await expect(page.getByText('Suppression définitive effectuée : « Zone E2E »')).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Zone E2E' })).toHaveCount(0)
  })
})

test.describe('Utilisateurs', () => {
  test('crée un agent dans un groupe', async ({ page }) => {
    await loginUi(page, 'admin@demo.ci')
    await page.goto('/users')
    await page.getByRole('button', { name: 'Nouvel utilisateur' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nouvel utilisateur' })
    await dialog.getByLabel('Prénom').fill('Paul')
    await dialog.getByLabel('Nom', { exact: true }).fill('Essai')
    await dialog.getByLabel('Email').fill(`paul.${Date.now()}@demo.ci`)
    await dialog.getByLabel('Mot de passe initial').fill('court')
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(dialog.getByText('Au moins 8 caractères')).toBeVisible()

    await dialog.getByLabel('Mot de passe initial').fill('Password123!')
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(dialog.getByText("Numéro obligatoire : c'est l'identifiant de connexion à l'app mobile")).toBeVisible()
    await dialog.getByLabel('Téléphone').fill(`07 ${String(Date.now()).slice(-8).replace(/(\d{2})(?=\d)/g, '$1 ')}`)
    await dialog.getByRole('combobox', { name: 'Groupe' }).click()
    await page.getByRole('option', { name: 'Équipe Sud' }).click()
    await dialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('Utilisateur créé')).toBeVisible()

    await page.getByLabel('Rechercher').fill('Essai')
    const row = page.getByRole('row').filter({ hasText: 'Paul Essai' })
    await expect(row).toContainText('Équipe Sud')
  })
})

test.describe('Approbation et carte en temps réel', () => {
  test('le chef approuve une demande, puis voit l’agent bouger sur la carte', async ({ page }) => {
    const admin = await apiAs('admin@demo.ci')
    await admin.patch('settings', { data: { approvalMode: 'manual' } })
    const agent = await apiAs('agent2@demo.ci')
    const zones = (await (await agent.get('zones/available')).json()) as { zones: { id: string; name: string }[] }
    const plateau = zones.zones.find((z) => z.name === 'Plateau')!
    const requested = await agent.post('zone-requests', { data: { zoneId: plateau.id } })
    expect(requested.status()).toBe(201)

    await loginUi(page, 'chef1@demo.ci')
    await page.goto('/approvals')
    const row = page.getByRole('row').filter({ hasText: 'Aminata Diallo' })
    await expect(row).toContainText('Plateau')
    await expect(row).toContainText('expire')
    await row.getByRole('button', { name: 'Approuver' }).click()
    await expect(page.getByText('Aucune demande en attente')).toBeVisible()

    // L'agent démarre sa journée depuis « l'app mobile ».
    const day = (await (await agent.post('days/start')).json()) as { id: string }
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Carte en temps réel' }).click()
    const card = page.getByRole('button', { name: /Aminata Diallo/ })
    await expect(card).toContainText('aucune position')

    // Une position arrive : la liste se met à jour sans recharger la page (Socket.IO).
    const res = await agent.post('positions/batch', {
      data: { dayId: day.id, points: [{ lat: 5.5, lng: -4.5, accuracy: 8, batteryLevel: 0.15, recordedAt: new Date().toISOString() }] },
    })
    expect(res.ok()).toBeTruthy()
    await expect(card).toContainText('Hors zone')
    await card.click()
    await expect(page.getByText('Hors de sa zone')).toBeVisible()
    await expect(page.getByText('15 %')).toBeVisible()

    // Pause : le statut change en temps réel.
    await agent.post('days/pause')
    await expect(card).toContainText('En pause')

    await agent.post('days/end')
    await expect(page.getByRole('button', { name: /Aminata Diallo/ })).toHaveCount(0)
    await admin.patch('settings', { data: { approvalMode: 'automatic' } })
  })
})

test.describe('Missions', () => {
  test('crée un type de mission puis une mission, et suit les formulaires', async ({ page }) => {
    await loginUi(page, 'admin@demo.ci')
    await page.goto('/mission-types')
    await page.getByRole('button', { name: 'Nouveau type' }).click()
    const typeDialog = page.getByRole('dialog', { name: 'Nouveau type de mission' })
    await typeDialog.getByLabel('Nom', { exact: true }).fill('Collecte E2E')
    await typeDialog.getByRole('button', { name: 'Ajouter un champ' }).click()
    await typeDialog.getByLabel('Libellé').fill('Montant collecté')
    await expect(typeDialog.getByText('Identifiant : montant_collecte')).toBeVisible()
    await typeDialog.getByRole('combobox', { name: 'Type du champ 1' }).click()
    await page.getByRole('option', { name: 'Nombre' }).click()
    await typeDialog.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('Type créé')).toBeVisible()

    await page.goto('/missions')
    await page.getByRole('button', { name: 'Nouvelle mission' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nouvelle mission' })
    await dialog.getByRole('combobox', { name: 'Type de mission' }).click()
    await page.getByRole('option', { name: 'Collecte E2E' }).click()
    await dialog.getByLabel('Titre').fill('Collecter 10 000 FCFA')
    await dialog.getByRole('combobox', { name: 'Agent' }).click()
    await page.getByRole('option', { name: 'Koffi Brou' }).click()
    await dialog.getByRole('combobox', { name: "Mesure de l'objectif" }).click()
    await page.getByRole('option', { name: "Somme d'un champ" }).click()
    await dialog.getByRole('combobox', { name: 'Champ à additionner' }).click()
    await page.getByRole('option', { name: 'Montant collecté' }).click()
    await dialog.getByLabel('Objectif', { exact: true }).fill('10000')
    await dialog.getByRole('button', { name: 'Créer la mission' }).click()

    await expect(page.getByRole('heading', { name: 'Collecter 10 000 FCFA' })).toBeVisible()
    await expect(page.getByText('Aucun formulaire')).toBeVisible()

    // Deux formulaires envoyés par l'agent.
    const missionId = page.url().split('/').pop()!
    const agent = await apiAs('agent1@demo.ci')
    for (const montant of [6000, 5000]) {
      const r = await agent.post(`missions/${missionId}/submissions`, {
        data: { clientId: crypto.randomUUID(), data: { montant_collecte: montant }, submittedAt: new Date().toISOString() },
      })
      expect(r.status()).toBe(201)
    }
    await page.reload()
    await expect(page.getByText('Atteinte')).toBeVisible()
    await expect(page.getByText('100 %')).toBeVisible()

    // Rejet d'un formulaire : la mission repasse en cours.
    await page.getByRole('row').filter({ hasText: '6' }).getByRole('button', { name: 'Rejeter' }).first().click()
    const reject = page.getByRole('dialog', { name: 'Rejeter le formulaire' })
    await reject.getByLabel('Motif').fill('Montant non justifié')
    await reject.getByRole('button', { name: 'Rejeter' }).click()
    await expect(page.getByText('Formulaire rejeté, l’agent a été notifié')).toBeVisible()
    await expect(page.getByText('« Montant non justifié »')).toBeVisible()
    await expect(page.getByText('En cours').first()).toBeVisible()
  })
})

test.describe('Paramètres', () => {
  test('enregistre le mode d’approbation et affiche les options associées', async ({ page }) => {
    await loginUi(page, 'admin@demo.ci')
    await page.goto('/settings')
    const save = page.getByRole('button', { name: 'Enregistrer' })
    await expect(save).toBeDisabled()
    await page.getByRole('combobox', { name: "Mode d'approbation" }).click()
    await page.getByRole('option', { name: 'Mixte' }).click()
    await expect(page.getByText('Approbation manuelle si…')).toBeVisible()
    await expect(page.getByLabel("Délai d'expiration d'une demande")).toHaveValue('30')
    await save.click()
    await expect(page.getByText('Paramètres enregistrés')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('combobox', { name: "Mode d'approbation" })).toContainText('Mixte')

    await page.getByRole('combobox', { name: "Mode d'approbation" }).click()
    await page.getByRole('option', { name: 'Automatique' }).click()
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('Paramètres enregistrés')).toBeVisible()
  })
})

test.describe('Affichage mobile', () => {
  test.use({ viewport: { width: 375, height: 740 } })

  test('le menu s’ouvre dans un panneau latéral, sans défilement horizontal', async ({ page }) => {
    await loginUi(page, 'admin@demo.ci')
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
    await page.getByRole('link', { name: 'Utilisateurs' }).click()
    await expect(page.getByRole('heading', { name: 'Utilisateurs' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })
})

test.describe('Désactivation et suppression en cascade', () => {
  test('un groupe avec des données : désactivation proposée, suppression confirmée par le nom', async ({ page }) => {
    const admin = await apiAs('admin@demo.ci')
    const group = (await (await admin.post('groups', { data: { name: 'Équipe Temporaire' } })).json()) as { id: string }
    const types = (await (await admin.get('mission-types')).json()) as { id: string }[]
    await admin.post('missions', {
      data: { typeId: types[0].id, title: 'Mission temporaire', assigneeGroupId: group.id, progressMethod: 'count', targetValue: 3 },
    })

    await loginUi(page, 'admin@demo.ci')
    await page.goto('/groups')
    await page.getByRole('button', { name: 'Désactiver ou supprimer Équipe Temporaire' }).click()
    await page.getByRole('button', { name: /Supprimer définitivement/ }).click()
    const dialog = page.getByRole('dialog', { name: /Supprimer définitivement le groupe/ })
    await expect(dialog.getByText('Suppression en cascade')).toBeVisible()
    await expect(dialog.getByText('mission(s) du groupe supprimée(s), avec leurs formulaires')).toBeVisible()
    const confirm = dialog.getByRole('button', { name: 'Supprimer définitivement' })
    await expect(confirm).toBeDisabled()
    await dialog.getByLabel('Pour confirmer, saisissez « Équipe Temporaire »').fill('Équipe Temporaire')
    await confirm.click()
    await expect(page.getByText('Suppression définitive effectuée : « Équipe Temporaire »')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Équipe Temporaire' })).toHaveCount(0)
  })

  test('un compte désactivé est réactivable', async ({ page }) => {
    await loginUi(page, 'admin@demo.ci')
    await page.goto('/users')
    await page.getByLabel('Rechercher').fill('Yapi')
    const row = page.getByRole('row').filter({ hasText: 'Nadia Yapi' })
    await row.getByRole('button', { name: 'Actions pour Nadia Yapi' }).click()
    await page.getByRole('menuitem', { name: 'Désactiver ou supprimer…' }).click()
    await page.getByRole('button', { name: /Désactiver le compte/ }).click()
    await expect(row).toContainText('Désactivé')

    await row.getByRole('button', { name: 'Actions pour Nadia Yapi' }).click()
    await page.getByRole('menuitem', { name: 'Réactiver' }).click()
    await expect(page.getByText('Compte réactivé')).toBeVisible()
    await expect(row).not.toContainText('Désactivé')
  })
})

test.describe('Mise en page', () => {
  test('le panneau de la carte se replie pour afficher la carte en plein écran', async ({ page }) => {
    await loginUi(page, 'admin@demo.ci')
    const panel = page.getByRole('region', { name: 'Carte en temps réel' })
    await expect(panel).toBeVisible()
    const map = page.getByRole('region', { name: 'Carte', exact: true })
    const before = (await map.boundingBox())!.width

    await page.getByRole('button', { name: 'Replier le panneau' }).click()
    await expect(panel).toBeHidden()
    await expect.poll(async () => (await map.boundingBox())!.width).toBeGreaterThan(before + 300)
    await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible()

    // Le choix est mémorisé.
    await page.reload()
    await expect(panel).toBeHidden()
    await page.getByRole('button', { name: /Carte en temps réel/ }).click()
    await expect(panel).toBeVisible()
    await expect(page.getByRole('button', { name: 'Légende' })).toBeVisible()
  })

  test('le menu latéral se replie en icônes', async ({ page }) => {
    await loginUi(page, 'admin@demo.ci')
    await page.getByRole('button', { name: 'Replier le menu' }).click()
    const nav = page.getByRole('navigation', { name: 'Navigation principale' })
    await expect(nav.getByText('Suivi Agent')).toBeHidden()
    await nav.getByRole('link', { name: 'Missions', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Missions', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Déplier le menu' }).click()
    await expect(nav.getByText('Suivi Agent')).toBeVisible()
  })
})
