# Web – Suivi Agent

Plateforme web des administrateurs et chefs d'équipe : React 19, Vite, TanStack Query, shadcn/ui (Base UI), Tailwind 4, Leaflet et Geoman.
Les agents utilisent l'app mobile : s'ils se connectent sur le web, un message les y renvoie.

## Démarrer

L'API doit tourner (voir [apps/backend/README.md](../backend/README.md)).

```bash
nvm use 20
npm run dev
```

Ouvrir http://localhost:5173 et se connecter, par exemple avec `admin@demo.ci` ou `chef1@demo.ci` (mot de passe `Password123!`).
Vite redirige `/api` et `/socket.io` vers l'API sur le port 3000.

## Écrans

| Écran | Admin | Chef d'équipe |
| --- | --- | --- |
| Carte en temps réel : agents, statuts, alertes (signal perdu, hors zone, position simulée), filtres, trajet | ✓ | ses groupes |
| Demandes de zone : file d'approbation, refus motivé, historique, réaffectation | ✓ | ses agents |
| Historique des journées : début, pauses, fin, durées, trajet sur la carte | ✓ | ses agents |
| Missions : création, progression, contributions, formulaires reçus, rejet | ✓ | ses agents et groupes |
| Zones : dessin sur la carte, capacité, zone sensible ou réservée, modification du tracé | ✓ | lecture |
| Groupes : chef, agents, zones (affiché si les groupes sont activés) | ✓ | lecture |
| Utilisateurs | ✓ | ses agents |
| Types de missions : éditeur de champs | ✓ | — |
| Paramètres, Agents actifs, Journal d'accès | ✓ | — |

## Ergonomie

- **Carte en temps réel et Zones** : le panneau de gauche se replie pour afficher la carte en plein écran. Le choix est mémorisé, et les outils Recadrer et Légende sont disponibles sur la carte.
- **Menu latéral** : il se replie en une colonne d'icônes, avec des infobulles. Le choix est mémorisé.
- **Demandes de zone en attente** : leur nombre s'affiche sur l'entrée du menu et dans un rappel cliquable de l'en-tête.
- **Retirer un élément** : le dialogue propose d'abord la désactivation, réversible. La suppression définitive détaille ce qui sera supprimé en cascade et se confirme en saisissant le nom de l'élément.

## Design

Le design system a été généré avec le skill `ui-ux-pro-max` et se trouve dans [design-system/suivi-agent/MASTER.md](../../design-system/suivi-agent/MASTER.md) :

- **Style** : Minimalism & Swiss Style, mode clair.
- **Couleurs** : bleu de confiance `#2563EB`.
- **Typographie** : Plus Jakarta Sans.
- **Densité** : interface dense, adaptée à un tableau de bord.

Les jetons de couleur sont définis dans [src/index.css](src/index.css). Les statuts sont toujours signalés par une icône et un libellé en plus de la couleur, et le contraste du texte est d'au moins 4,5:1.

## Tests

```bash
npm run test:e2e
```

Les tests démarrent l'API et Vite s'ils ne tournent pas déjà. Ils recréent les données de démo avant de s'exécuter.
Prérequis : `docker compose up -d` et la migration appliquée.

## Site vitrine

À la racine du site (`/`), rendu par `src/landing/` à partir du contenu publié depuis la console éditeur (menu « Contenu du site ») : animations pilotées par le défilement avec GSAP ScrollTrigger (`gsap.ts` : sections épinglées, révélations, galerie horizontale) et défilement amorti Lenis sur le site public, réglage « réduire les animations » respecté (tout s'affiche dans son état final). Appareils réalistes en CSS (`devices.tsx` : MacBook, iPhone), vraie carte d'Abidjan OpenStreetMap avec agents animés (`live-map.tsx`), écrans du produit (`screens.tsx`), ou images envoyées. Typographie Inter, mise en page par requêtes de conteneur (`@container`) pour que l'aperçu de la console soit fidèle en mode ordinateur et mobile. Les tarifs viennent du catalogue ; « Demander une démo » alimente la page « Demandes de démo » de la console.

## Console éditeur (super administrateur)

Espace séparé de celui des structures (`src/platform/`), chargé seulement sous son adresse secrète (`VITE_PLATFORM_PATH`) : tableau de bord (revenu récurrent, encaissements, impayés, essais), structures (filtres, création, fiche, abonnement et conditions négociées, suspension, notes), factures (paiement reçu hors plateforme, annulation), formules (création, prix, quotas et avantages appliqués aux structures), réglages de facturation (dont les formules de l'essai et de l'après-essai), comptes éditeur et journal.

Sécurité : double authentification par code à 6 chiffres (menu du compte → Sécurité du compte ; obligatoire si `PLATFORM_REQUIRE_MFA=true` côté API), comptes et jetons distincts de ceux des structures, session limitée à l'onglet (pas de jeton de renouvellement) et fermée après 30 minutes d'inactivité, page non indexée, verrouillage après 5 échecs de connexion (15 minutes), liste blanche d'adresses IP possible côté API (`PLATFORM_ALLOWED_IPS`). Démo : `sa@suivi.ci` / `Password123!`.

## Configuration

- `VITE_PLATFORM_PATH` : adresse secrète de la **console éditeur** (super administrateur), par exemple `/console-7k2m9x4q` (au moins 8 caractères après la barre oblique, à garder confidentielle et différente par environnement). Sans valeur, la console n'existe pas sur le déploiement. En développement, elle est définie dans `.env.local`.
- `VITE_TILE_URL` : URL des tuiles de carte (MapTiler, Stadia Maps…). Sans valeur, ce sont les tuiles publiques OpenStreetMap, à réserver au développement (voir la section 9 du cahier des charges).
