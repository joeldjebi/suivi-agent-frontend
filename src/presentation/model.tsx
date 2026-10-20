import { cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import type { PresentationContent } from './types'

/**
 * Modèle de présentation client : diaporama, fiches par rôle, déroulé et liste de démarrage,
 * tirés des informations du client. Une fonction désactivée retire ses diapositives et ses étapes.
 */

export interface Slide {
  id?: string
  /** Couverture (fond de la couleur du client) */
  cover?: boolean
  /** Capture de l'app (téléphone) ou du site (écran), à droite du texte */
  phone?: string
  screen?: string
  body: ReactNode
  /** À dire, affiché par la touche N en présentation */
  notes: string
}

export interface SheetStep {
  title: string
  image?: string
  /** Capture de téléphone (haute) plutôt que d'ordinateur */
  tall?: boolean
  text: ReactNode
}

export interface Sheet {
  role: string
  title: string
  subtitle: string
  steps: SheetStep[]
  help: string[]
}

export interface RunRow {
  when: string
  duration: string
  what: string
  screen: string
  tip: string
}

export interface PresentationModel {
  name: string
  slides: Slide[]
  sheets: Sheet[]
  run: RunRow[]
  start: { title: string; text: string }[]
}

const app = (f: string) => `/presentation/app/${f}.webp`
const web = (f: string) => `/presentation/web/${f}.webp`

/** « a, b et c » */
export const joinList = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}` : (items[0] ?? '')

const clean = (items: string[]) => items.map((s) => s.trim()).filter(Boolean)

/** Espaces insécables du français : « ? », « : », « ! », « ; » et les guillemets ne passent jamais seuls à la ligne. */
export const frenchSpaces = (text: string) => text.replace(/\s+([?!:;»])/g, '\u00a0$1').replace(/«\s+/g, '«\u00a0')

/** Applique les espaces insécables à tout le texte d'un contenu (chaînes et éléments imbriqués). */
export function typo(node: ReactNode): ReactNode {
  if (typeof node === 'string') return frenchSpaces(node)
  if (Array.isArray(node)) return node.map(typo)
  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode }>
    const children = element.props.children
    if (children === undefined) return element
    // Enfants écrits côte à côte : transmis un par un (pas comme une liste, qui demanderait des clés).
    return Array.isArray(children)
      ? cloneElement(element, undefined, ...children.map(typo))
      : cloneElement(element, undefined, typo(children))
  }
  return node
}

/** Date de la réunion en toutes lettres, ou aujourd'hui. */
export function meetingLabel(date: string | null) {
  const at = date ? new Date(`${date}T12:00:00`) : new Date()
  return at.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function buildPresentation(c: PresentationContent): PresentationModel {
  const M = c.modules
  const name = c.clientName.trim() || 'votre entreprise'
  const areas = clean(c.areas)
  const area = areas[0] ?? 'son quartier'
  const products = clean(c.products)
  const agent = c.agentName.trim() || 'Koffi'
  const outlets = c.outletWord.trim() || 'points de vente'
  const support = [c.supportEmail.trim(), c.supportPhone.trim()].filter(Boolean).join(' · ')
  /** « Votre chef d’équipe », « Vos 3 chefs d’équipe », « Vos chefs d’équipe » (nombre inconnu). */
  const yours = (n: number, one: string, many: string) => (n === 1 ? `Votre ${one}` : n > 1 ? `Vos ${n} ${many}` : `Vos ${many}`)
  /** Quartiers cités : la liste complète, ou les 5 premiers suivis de « … ». */
  const areaList = areas.length > 5 ? `${areas.slice(0, 5).join(', ')}…` : joinList(areas)

  const slides: (Slide | false)[] = [
    {
      id: 'cover',
      cover: true,
      body: (
        <>
          <h3>
            Vos équipes terrain,
            <br />
            sous vos yeux.
          </h3>
          <p>
            Présentation pour {name}
            {c.trade.trim() ? `, ${c.trade.trim()}` : ''} · {meetingLabel(c.meetingDate)}
          </p>
        </>
      ),
      notes: `Se présenter simplement. Annoncer la durée (environ 30 minutes, puis vos questions) et le programme.`,
    },
    {
      id: 'questions',
      body: (
        <>
          <div className="pxp-kicker">Aujourd’hui chez {name}</div>
          <h3>Les questions que vous vous posez chaque jour</h3>
          <div className="pxp-bubbles">
            <div>
              Où sont mes agents, en ce moment ?<small>Sans les appeler un par un.</small>
            </div>
            <div>
              Ont-ils vraiment visité les clients ?<small>Avec une preuve, pas seulement une parole.</small>
            </div>
            <div>
              {M.orders ? 'Combien ont-ils vendu aujourd’hui ?' : 'Qu’ont-ils fait aujourd’hui ?'}
              <small>Sans attendre le rapport papier.</small>
            </div>
            <div>
              {M.pay ? 'Qui mérite une prime ce mois-ci ?' : 'Qui a bien travaillé ce mois-ci ?'}
              <small>Avec des chiffres justes, pour tous.</small>
            </div>
          </div>
        </>
      ),
      notes: `Poser vraiment la question au client : « Laquelle de ces questions vous pose le plus de soucis aujourd'hui ? ». Le laisser parler : on s'appuiera sur sa réponse pendant la démonstration.`,
    },
    {
      body: (
        <>
          <div className="pxp-kicker">PerformX en une phrase</div>
          <h3>Une application qui répond à ces questions, chaque jour, toute seule.</h3>
          <div className="pxp-cards">
            <div>
              <span className="pxp-emoji">💻</span>
              <b>Vous, le responsable</b>
              <span>Sur l’ordinateur : vous voyez toute l’équipe, les rapports{M.pay ? ' et la paie' : ''}.</span>
            </div>
            <div>
              <span className="pxp-emoji">📱</span>
              <b>{yours(c.leads, 'chef d’équipe', 'chefs d’équipe')}</b>
              <span>Sur le téléphone : ils suivent leurs agents et reçoivent les alertes.</span>
            </div>
            <div>
              <span className="pxp-emoji">📱</span>
              <b>{yours(c.agents, 'agent', 'agents')}</b>
              <span>Sur le téléphone : l’app les guide, du matin jusqu’au soir.</span>
            </div>
          </div>
        </>
      ),
      notes: `Insister : chacun a SON outil, simple. Les agents n'ont rien à apprendre de compliqué : quelques boutons, toujours les mêmes.`,
    },
    {
      id: 'how',
      body: (
        <>
          <div className="pxp-kicker">Comment ça marche</div>
          <h3>Trois étapes, c’est tout.</h3>
          <div className="pxp-steps">
            <div>
              <span className="pxp-n">1</span>
              <b>Vous préparez</b>
              <span>
                Les quartiers, {M.missions ? 'les missions, ' : ''}
                {M.outlets ? 'les points de vente, ' : ''}les agents. Nous le faisons avec vous.
              </span>
            </div>
            <div>
              <span className="pxp-n">2</span>
              <b>L’agent travaille</b>
              <span>Avec son téléphone, comme d’habitude, guidé par l’app.</span>
            </div>
            <div>
              <span className="pxp-n">3</span>
              <b>Vous voyez tout</b>
              <span>En direct, et chaque soir un bilan complet.</span>
            </div>
          </div>
        </>
      ),
      notes: `Rassurer sur l'étape 1 : « Vous n'avez pas à tout faire seul, nous configurons tout ensemble la première semaine. »`,
    },
    {
      id: 'day',
      body: (
        <>
          <div className="pxp-kicker">Une journée chez {name}</div>
          <h3>Suivons {agent}, du matin au soir.</h3>
          <div className="pxp-timeline">
            <div>
              <b>07:45</b>
              <span>Il démarre sa journée</span>
            </div>
            {M.missions && (
              <div>
                <b>08:15</b>
                <span>Il voit ses missions</span>
              </div>
            )}
            {M.missions && !M.outlets && (
              <div>
                <b>10:00</b>
                <span>Il remplit un formulaire</span>
              </div>
            )}
            {M.outlets && (
              <>
                <div>
                  <b>08:30</b>
                  <span>Il suit sa tournée</span>
                </div>
                <div>
                  <b>09:10</b>
                  <span>Il visite un client</span>
                </div>
              </>
            )}
            {M.orders && (
              <div>
                <b>09:35</b>
                <span>Il prend une commande</span>
              </div>
            )}
            <div>
              <b>11:00</b>
              <span>Le chef suit en direct</span>
            </div>
            <div>
              <b>18:00</b>
              <span>Vous recevez le bilan</span>
            </div>
          </div>
        </>
      ),
      notes: `Annoncer le fil rouge : on va vivre une vraie journée de ${agent}, agent sur la zone ${area}.`,
    },
    {
      phone: app('01-journee'),
      body: (
        <>
          <div className="pxp-kicker">07:45 · Le matin</div>
          <h3>{agent} démarre sa journée</h3>
          <ul>
            <li>
              Il choisit son quartier, par exemple <strong>{area}</strong>.
            </li>
            <li>
              Un seul bouton : <strong>« Démarrer ma journée »</strong>.
            </li>
            <li>Son temps de travail est compté tout seul, pauses comprises.</li>
            <li>Sa position n’est partagée que pendant sa journée, jamais en dehors.</li>
          </ul>
        </>
      ),
      notes: `Point important pour les agents (et souvent une crainte) : on ne les suit PAS en dehors du travail. Le suivi s'arrête quand ils terminent leur journée.`,
    },
    M.missions && {
      phone: app('06-agent-missions'),
      body: (
        <>
          <div className="pxp-kicker">08:15 · Les missions</div>
          <h3>Chaque agent sait ce qu’on attend de lui</h3>
          <ul>
            <li>
              Ses missions du moment : celles de <strong>son équipe</strong> et les siennes.
            </li>
            <li>
              Un <strong>objectif chiffré</strong> et une échéance : « 120 visites cette semaine ».
            </li>
            <li>L’avancement se met à jour à chaque formulaire envoyé.</li>
            <li>Plus besoin d’appeler le chef pour savoir quoi faire.</li>
          </ul>
        </>
      ),
      notes: `Les missions, c'est la réponse à « Qu'ont-ils fait aujourd'hui ? » : un objectif clair pour l'agent, un avancement chiffré pour vous.`,
    },
    M.missions && {
      id: 'form',
      phone: app('41-agent-visite'),
      body: (
        <>
          <div className="pxp-kicker">{M.outlets ? '09:15' : '10:00'} · Le formulaire</div>
          <h3>{agent} remplit le formulaire, sur place</h3>
          <ul>
            <li>
              <strong>Vos questions à vous</strong> : texte, choix, nombre, date, photo.
            </li>
            <li>Sa présence sur place est vérifiée par la position du téléphone.</li>
            <li>Sans réseau, le formulaire est gardé et envoyé plus tard.</li>
            <li>Le chef peut le refuser, avec un motif : l’agent est prévenu.</li>
          </ul>
        </>
      ),
      notes: `Insister : le formulaire est fait sur mesure pour le client (prospection, relevé de prix, audit, collecte…). On le prépare ensemble la première semaine.`,
    },
    M.outlets && {
      phone: app('02-tournee'),
      body: (
        <>
          <div className="pxp-kicker">08:30 · Le départ</div>
          <h3>La tournée est tracée</h3>
          <ul>
            <li>La liste des {outlets} à visiter aujourd’hui.</li>
            <li>Dans le bon ordre, pour faire moins de route.</li>
            <li>
              Le trajet s’ouvre dans <strong>Google Maps</strong> en un geste.
            </li>
            <li>Les clients en retard de visite sont signalés.</li>
          </ul>
        </>
      ),
      notes: `Montrer que l'agent gagne du temps : plus besoin de réfléchir à son itinéraire.`,
    },
    M.outlets && {
      id: 'visit',
      phone: app('03-fiche-point-de-vente'),
      body: (
        <>
          <div className="pxp-kicker">09:10 · Chez le client</div>
          <h3>Tout sur le client, avant d’entrer</h3>
          <ul>
            <li>Son nom, son gérant, son téléphone, un repère.</li>
            <li>Sa dernière visite et ce qui s’y est passé.</li>
            <li>
              {agent} touche <strong>« Visiter »</strong> : sa présence sur place est vérifiée.
            </li>
          </ul>
        </>
      ),
      notes: `La visite n'est validée que si l'agent est vraiment chez le client (à 50 m près). C'est la « preuve » de la question 2.`,
    },
    M.outlets && {
      phone: app('04-releve-produits'),
      body: (
        <>
          <div className="pxp-kicker">09:25 · Le relevé</div>
          <h3>Stocks et prix relevés sur place</h3>
          <ul>
            <li>
              Pour chaque produit
              {products.length ? (
                <>
                  {' '}
                  (<strong>{joinList(products.slice(0, 3))}</strong>…)
                </>
              ) : null}
              {'\u00a0'}: présent ou non, stock, prix.
            </li>
            <li>
              Les <strong>ruptures</strong> sont signalées tout de suite.
            </li>
            <li>Les produits concurrents aussi.</li>
            <li>Une photo du rayon peut être demandée.</li>
          </ul>
        </>
      ),
      notes: `Demander au client : « Aujourd'hui, comment savez-vous qu'un client est en rupture ? ». Ici il le sait le jour même.`,
    },
    M.orders && {
      phone: app('05-commande'),
      body: (
        <>
          <div className="pxp-kicker">09:35 · La commande</div>
          <h3>La commande est prise</h3>
          <ul>
            <li>Les prix du client sont déjà là.</li>
            <li>Les casiers et cartons se calculent tout seuls.</li>
            <li>Le total s’affiche en direct.</li>
            <li>Ensuite : livrée ? payée ? Tout est suivi.</li>
          </ul>
        </>
      ),
      notes: `Même sans réseau, la commande est gardée sur le téléphone et envoyée dès que le réseau revient. Rien n'est perdu.`,
    },
    {
      phone: app('06-chef-en-direct'),
      body: (
        <>
          <div className="pxp-kicker">11:00 · Le chef d’équipe</div>
          <h3>Le chef suit son équipe en direct</h3>
          <ul>
            <li>Tous ses agents sur la carte, avec leur quartier.</li>
            <li>Qui travaille, qui est en pause, qui n’a pas commencé.</li>
            <li>Il appelle un agent d’un seul geste.</li>
          </ul>
        </>
      ),
      notes: `Le chef n'a plus besoin d'appeler pour savoir où sont ses agents : il regarde.`,
    },
    {
      phone: app('31-chef-alertes'),
      body: (
        <>
          <div className="pxp-kicker">Les alertes</div>
          <h3>PerformX vous prévient quand quelque chose ne va pas</h3>
          <ul>
            <li>
              <span className="pxp-tag pxp-bad">Hors zone</span> l’agent a quitté son quartier.
            </li>
            <li>
              <span className="pxp-tag pxp-bad">Signal perdu</span> plus de position depuis un moment.
            </li>
            <li>
              <span className="pxp-tag pxp-bad">Position suspecte</span> une fausse position est utilisée.
            </li>
            <li>
              <span className="pxp-tag pxp-warn">Pas démarrée</span> la journée n’a pas commencé à l’heure.
            </li>
            <li>
              <span className="pxp-tag pxp-warn">Immobile</span> l’agent ne bouge plus depuis longtemps.
            </li>
          </ul>
        </>
      ),
      notes: `Rassurer : les alertes ne sont pas là pour punir, mais pour aider (un agent en difficulté, un téléphone en panne...). Le chef note ce qu'il a fait.`,
    },
    {
      id: 'report',
      screen: web('rapport'),
      body: (
        <>
          <div className="pxp-kicker">18:00 · Le bilan</div>
          <h3>Chaque soir, le bilan de la journée</h3>
          <ul>
            <li>Qui a travaillé, combien d’heures, dans quel quartier.</li>
            <li>
              {M.outlets ? 'Les visites et les relevés' : 'Les formulaires envoyés'}
              {M.orders ? ', les ventes' : ''}.
            </li>
            <li>Les alertes de la journée.</li>
            <li>Envoyé tout seul aux responsables.</li>
          </ul>
        </>
      ),
      notes: `C'est la réponse à toutes les questions du début, sans aucun papier.`,
    },
    {
      id: 'dashboard',
      screen: web('en-direct'),
      body: (
        <>
          <div className="pxp-kicker">Sur votre ordinateur</div>
          <h3>Votre tableau de bord</h3>
          <ul>
            <li>La carte en direct de toute l’équipe.</li>
            <li>Les rapports, les statistiques, les exports Excel.</li>
            <li>Vous ajoutez un agent ou un quartier en quelques clics.</li>
            <li>
              Adresse : <strong>performx.online</strong>
            </li>
          </ul>
        </>
      ),
      notes: `Ici, basculer sur l'ordinateur et faire la démonstration en direct (voir le déroulé).`,
    },
    M.missions && {
      screen: web('missions'),
      body: (
        <>
          <div className="pxp-kicker">Les missions, côté responsable</div>
          <h3>Vous fixez les objectifs</h3>
          <ul>
            <li>Pour une équipe, un agent, des quartiers.</li>
            <li>
              Objectif : un <strong>nombre de visites</strong>, un <strong>montant</strong> ou une validation.
            </li>
            <li>À faire, en cours, atteinte : d’un coup d’œil.</li>
            {M.pay && <li>Une prime liée à l’objectif atteint.</li>}
          </ul>
        </>
      ),
      notes: `Montrer une mission en direct pendant la démo : sa barre d'avancement bouge dès qu'un agent envoie un formulaire.`,
    },
    M.missions && {
      screen: web('statistiques'),
      body: (
        <>
          <div className="pxp-kicker">Les formulaires en chiffres</div>
          <h3>Vos chiffres, sans papier</h3>
          <ul>
            <li>Tous les formulaires reçus, validés ou refusés par les chefs.</li>
            <li>Les réponses additionnées question par question.</li>
            <li>Par période, équipe, quartier ou agent.</li>
            <li>Export Excel en un clic.</li>
          </ul>
        </>
      ),
      notes: `Faire le lien avec la question 4 : des chiffres justes pour tous, pour récompenser les meilleurs.`,
    },
    M.pay && {
      phone: app('18-agent-mes-gains'),
      body: (
        <>
          <div className="pxp-kicker">La rémunération</div>
          <h3>La paie calculée toute seule, sans discussion</h3>
          <ul>
            <li>
              Selon vos règles : jours travaillés, {M.outlets ? 'visites, ' : ''}
              {M.orders ? 'ventes, ' : ''}primes.
            </li>
            <li>Chaque agent voit ce qu’il a gagné, au jour le jour.</li>
            <li>Le chef propose une prime, vous validez.</li>
          </ul>
        </>
      ),
      notes: `Argument fort pour les agents : ils voient eux-mêmes leurs gains, c'est motivant et ça évite les litiges en fin de mois.`,
    },
    {
      id: 'roles',
      body: (
        <>
          <div className="pxp-kicker">Qui fait quoi ?</div>
          <h3>Chacun son rôle, chacun son outil</h3>
          <table className="pxp-roles">
            <thead>
              <tr>
                <th />
                <th>Outil</th>
                <th>Ce qu’il fait</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Vous, le responsable</td>
                <td>Ordinateur</td>
                <td>
                  Prépare (agents, quartiers{M.missions ? ', missions' : ''}), suit, consulte les rapports
                  {M.pay ? ' et valide la paie' : ''}.
                </td>
              </tr>
              <tr>
                <td>Le chef d’équipe</td>
                <td>Téléphone</td>
                <td>
                  Suit ses agents, traite les alertes, valide les demandes{M.missions ? ', contrôle les formulaires' : ''}, envoie des
                  messages.
                </td>
              </tr>
              <tr>
                <td>L’agent</td>
                <td>Téléphone</td>
                <td>
                  Démarre sa journée{M.missions ? ', remplit ses formulaires de mission' : ''}
                  {M.outlets ? ', visite ses clients, fait ses relevés' : ''}
                  {M.orders ? ', prend les commandes' : ''}.
                </td>
              </tr>
            </tbody>
          </table>
        </>
      ),
      notes: `Laisser cette diapositive le temps que le client se projette : « Qui sera chef d'équipe chez vous ? ».`,
    },
    {
      body: (
        <>
          <div className="pxp-kicker">Vos données</div>
          <h3>Protégées et à vous</h3>
          <ul>
            <li>Chacun ne voit que ce qui le concerne : l’agent ses données, le chef son équipe.</li>
            <li>La position des agents n’est enregistrée que pendant leur journée de travail.</li>
            <li>Les échanges sont chiffrés, et l’app peut se verrouiller par code ou empreinte.</li>
            <li>Vos données ne sont jamais revendues, ni utilisées pour de la publicité.</li>
          </ul>
        </>
      ),
      notes: `Rappeler au client qu'il doit informer ses agents du suivi pendant le travail (c'est aussi la loi). Nous fournissons un modèle de note d'information.`,
    },
    {
      id: 'needs',
      body: (
        <>
          <div className="pxp-kicker">Pour démarrer</div>
          <h3>Ce dont nous avons besoin de vous</h3>
          <ul>
            <li>
              <strong>La liste de vos agents et chefs</strong> : nom et numéro de téléphone.
            </li>
            <li>
              <strong>Vos quartiers de travail</strong>
              {areas.length ? ` : ${areaList}.` : '.'}
            </li>
            {M.outlets && (
              <li>
                <strong>Vos clients</strong> : nom, quartier, téléphone (un fichier Excel suffit).
              </li>
            )}
            {M.orders && (
              <li>
                <strong>Vos produits et vos prix</strong>.
              </li>
            )}
            {M.pay && (
              <li>
                <strong>Vos règles de rémunération</strong> : fixe, primes.
              </li>
            )}
          </ul>
        </>
      ),
      notes: `Fixer ensemble une date de remise des informations.`,
    },
    {
      id: 'start',
      body: (
        <>
          <div className="pxp-kicker">Le démarrage</div>
          <h3>Un mois pour être prêts</h3>
          <div className="pxp-timeline">
            <div>
              <b>Semaine 1</b>
              <span>Nous configurons tout avec vous.</span>
            </div>
            <div>
              <b>Semaine 2</b>
              <span>Formation des chefs et de 2 ou 3 agents pilotes.</span>
            </div>
            <div>
              <b>Semaine 3</b>
              <span>Toute l’équipe sur le terrain avec PerformX.</span>
            </div>
            <div>
              <b>Semaine 4</b>
              <span>Premier bilan ensemble, et ajustements.</span>
            </div>
          </div>
        </>
      ),
      notes: `Proposer une date de démarrage concrète avant de quitter la réunion.`,
    },
    {
      id: 'support',
      body: (
        <>
          <div className="pxp-kicker">À vos côtés</div>
          <h3>Vous n’êtes jamais seul</h3>
          <ul>
            <li>
              Des <strong>fiches imprimées</strong> pour chaque rôle, à garder près de soi.
            </li>
            <li>
              Une <strong>formation</strong> sur place pour les chefs et les agents.
            </li>
            <li>
              Une aide dans l’app et sur <strong>performx.online/assistance</strong>.
            </li>
            {support && <li>Une question ? {support}</li>}
          </ul>
        </>
      ),
      notes: `Remettre les fiches imprimées maintenant.`,
    },
    {
      id: 'end',
      cover: true,
      body: (
        <>
          <h3>
            Merci.
            <br />
            Vos questions ?
          </h3>
          {support && <p>{support}</p>}
        </>
      ),
      notes: `Répondre aux questions, puis conclure par la date de démarrage.`,
    },
  ]

  const sheets: Sheet[] = [
    {
      role: 'Agent',
      title: 'Ma journée avec PerformX',
      subtitle: `${name} · sur mon téléphone`,
      steps: [
        { title: 'Installer l’app', text: 'Votre chef vous donne le lien. Installez « PerformX », puis ouvrez-la.' },
        {
          title: 'Me connecter',
          image: app('01-connexion'),
          tall: true,
          text: (
            <>
              Tapez votre <b>numéro de téléphone</b> et le <b>mot de passe</b> donné par votre chef.
            </>
          ),
        },
        {
          title: 'Choisir mon quartier',
          image: app('07-choix-zone'),
          tall: true,
          text: (
            <>
              Le matin, touchez <b>« Choisir ma zone »</b>, par exemple {area}.
            </>
          ),
        },
        {
          title: 'Démarrer ma journée',
          image: app('01-journee'),
          tall: true,
          text: (
            <>
              Touchez <b>« Démarrer ma journée »</b>. Gardez votre téléphone avec vous, l’app peut rester en arrière-plan.
            </>
          ),
        },
        ...(M.missions
          ? [
              {
                title: 'Voir mes missions',
                image: app('06-agent-missions'),
                tall: true,
                text: (
                  <>
                    Onglet <b>« Missions »</b> : ce qu’on attend de vous aujourd’hui.
                  </>
                ),
              },
            ]
          : []),
        ...(M.outlets
          ? [
              {
                title: 'Visiter un client',
                image: app('03-fiche-point-de-vente'),
                tall: true,
                text: (
                  <>
                    Ouvrez le point de vente, touchez <b>« Visiter »</b> une fois sur place, remplissez le relevé.
                  </>
                ),
              },
            ]
          : []),
        ...(M.orders
          ? [
              {
                title: 'Prendre une commande',
                image: app('05-commande'),
                tall: true,
                text: (
                  <>
                    Sur la fiche du client, touchez <b>« Commander »</b>, choisissez les quantités, envoyez.
                  </>
                ),
              },
            ]
          : []),
        {
          title: 'Pause et fin de journée',
          image: app('04-agent-en-journee'),
          tall: true,
          text: (
            <>
              <b>« Pause »</b> pour une pause, <b>« Terminer »</b> le soir : le suivi s’arrête.
            </>
          ),
        },
      ],
      help: [
        'Pas de réseau ? Continuez : tout est gardé sur le téléphone et envoyé au retour du réseau.',
        'Mot de passe oublié ? Demandez à votre chef d’équipe, il le réinitialise.',
        'Message « hors zone » ? Revenez dans votre quartier, ou demandez à votre chef de changer de zone.',
      ],
    },
    {
      role: 'Chef d’équipe',
      title: 'Suivre mon équipe avec PerformX',
      subtitle: `${name} · sur mon téléphone`,
      steps: [
        { title: 'Me connecter', image: app('01-connexion'), tall: true, text: 'Avec votre numéro de téléphone et votre mot de passe.' },
        {
          title: 'Voir mon équipe',
          image: app('08-chef-equipe'),
          tall: true,
          text: (
            <>
              Onglet <b>« Équipe »</b> : qui travaille, qui est en pause, qui n’a pas commencé.
            </>
          ),
        },
        {
          title: 'Suivre sur la carte',
          image: app('11-chef-carte'),
          tall: true,
          text: (
            <>
              Onglet <b>« Carte »</b> : tous vos agents, en direct. Touchez un agent pour l’appeler.
            </>
          ),
        },
        {
          title: 'Traiter une alerte',
          image: app('31-chef-alertes'),
          tall: true,
          text: 'Une alerte arrive en notification. Ouvrez-la, appelez l’agent, notez ce que vous avez fait.',
        },
        {
          title: 'Valider une demande de zone',
          image: app('09-chef-demandes'),
          tall: true,
          text: (
            <>
              Onglet <b>« Demandes »</b> : acceptez ou refusez le quartier demandé par un agent.
            </>
          ),
        },
        {
          title: 'Envoyer un message',
          image: app('34-chef-message'),
          tall: true,
          text: (
            <>
              <b>« Message à l’équipe »</b> : une consigne arrive sur le téléphone de tous vos agents.
            </>
          ),
        },
        {
          title: 'Le bilan du soir',
          image: app('33-chef-bilan'),
          tall: true,
          text: (
            <>
              <b>« Bilan du jour »</b> : heures, visites, alertes de votre équipe.
            </>
          ),
        },
      ],
      help: [
        'Un agent ne peut pas se connecter ? Vérifiez son numéro, ou demandez au responsable de réinitialiser son mot de passe.',
        '« Signal perdu » : appelez l’agent, son téléphone est peut-être éteint ou sans batterie.',
        'Une question sur l’app : performx.online/assistance.',
      ],
    },
    {
      role: 'Responsable',
      title: 'Piloter avec PerformX',
      subtitle: `${name} · sur l’ordinateur, à l’adresse performx.online`,
      steps: [
        {
          title: 'Me connecter',
          image: web('connexion'),
          text: (
            <>
              Ouvrez <b>performx.online</b>, cliquez sur « Se connecter », entrez votre e-mail et votre mot de passe.
            </>
          ),
        },
        {
          title: 'Voir l’équipe en direct',
          image: web('en-direct'),
          text: (
            <>
              <b>« En direct »</b> : la carte de tous les agents, les alertes et les demandes.
            </>
          ),
        },
        {
          title: 'Ajouter un agent',
          image: web('equipe'),
          text: (
            <>
              <b>« Équipe »</b> → « Nouvel utilisateur » : nom, numéro, groupe. Il reçoit son mot de passe.
            </>
          ),
        },
        {
          title: 'Créer un quartier',
          image: web('zones'),
          text: (
            <>
              <b>« Zones »</b> → dessinez le quartier sur la carte, donnez-lui un nom.
            </>
          ),
        },
        ...(M.missions
          ? [
              {
                title: 'Créer une mission',
                image: web('missions'),
                text: (
                  <>
                    <b>« Missions »</b> : un objectif, des quartiers, une date. Les agents la voient aussitôt.
                  </>
                ),
              },
            ]
          : []),
        ...(M.outlets
          ? [
              {
                title: 'Mes points de vente',
                image: web('points-de-vente'),
                text: (
                  <>
                    <b>« Points de vente »</b> : tous vos clients, importables depuis un fichier Excel.
                  </>
                ),
              },
            ]
          : []),
        ...(M.orders
          ? [
              {
                title: 'Les commandes',
                image: web('commandes'),
                text: (
                  <>
                    <b>« Commandes »</b> : à livrer, livrées, payées. Exportables.
                  </>
                ),
              },
            ]
          : []),
        {
          title: 'Rapports et exports',
          image: web('rapport'),
          text: (
            <>
              <b>« Rapports »</b> : bilan du jour, historique, statistiques, exports Excel.
            </>
          ),
        },
        ...(M.pay
          ? [
              {
                title: 'La rémunération',
                image: web('paie'),
                text: (
                  <>
                    <b>« Rémunération »</b> : vos règles, la paie calculée, à valider en fin de mois.
                  </>
                ),
              },
            ]
          : []),
      ],
      help: [
        'Un agent a perdu son mot de passe : « Équipe » → l’agent → « Réinitialiser le mot de passe ».',
        'Un agent quitte l’entreprise : désactivez son compte, son historique est gardé.',
        ...(support ? [`Besoin d’aide : ${support}`] : []),
      ],
    },
  ]

  const start = [
    { title: 'La liste des agents et chefs', text: 'Nom, prénom, numéro de téléphone, équipe. Un tableau Excel suffit.' },
    {
      title: 'Les quartiers de travail',
      text: `${areas.length ? `${areaList} : n` : 'N'}ous les dessinons ensemble sur la carte.`,
    },
    M.outlets && { title: 'La liste des clients', text: 'Nom, quartier, téléphone, catégorie. Fichier Excel.' },
    M.orders && { title: 'Les produits et les prix', text: 'Par type de client si les prix diffèrent.' },
    M.missions && { title: 'Les missions du mois', text: 'Ce que chaque équipe doit accomplir (visites, relevés, objectifs).' },
    M.pay && { title: 'Les règles de rémunération', text: 'Fixe, prime par jour, par visite ou par vente, plafonds.' },
    { title: 'Les téléphones des agents', text: 'Android ou iPhone récents, avec Internet. L’app s’installe en 2 minutes.' },
    { title: 'La note d’information aux agents', text: 'Nous vous fournissons le modèle : suivi pendant la journée de travail seulement.' },
  ].filter((x): x is { title: string; text: string } => !!x)

  const list = slides.filter((s): s is Slide => !!s)
  // Avec les points de vente, le formulaire se remplit chez le client : juste après la visite.
  const form = list.findIndex((s) => s.id === 'form')
  if (form > -1 && list.some((s) => s.id === 'visit')) {
    const [moved] = list.splice(form, 1)
    list.splice(list.findIndex((s) => s.id === 'visit') + 1, 0, moved)
  }

  // Programme de la réunion (les numéros de diapositives sont posés une fois le diaporama complet).
  const agenda: [string, string, string, string, string][] = [
    [
      '0:00',
      '3 min',
      'Accueil, présentation, plan de la réunion',
      'cover:agenda',
      'Annoncer : 30 minutes de présentation, puis vos questions.',
    ],
    ['0:03', '5 min', 'Ses questions d’aujourd’hui', 'questions:how', 'Faire parler le client : quelle question lui coûte le plus ?'],
    [
      '0:08',
      '10 min',
      'Une journée avec PerformX',
      'day:report',
      `Raconter la journée de « ${agent}, agent sur la zone ${area} ». Une idée par diapo.`,
    ],
    [
      '0:18',
      '10 min',
      'Démonstration en direct sur l’ordinateur',
      'dashboard:roles-1',
      'Montrer la carte en direct, un agent, une alerte, le bilan du jour.',
    ],
    ['0:28', '5 min', 'Démonstration sur le téléphone', '', 'Faire démarrer une journée au client lui-même, sur un téléphone de démo.'],
    ['0:33', '4 min', 'Qui fait quoi, vos données', 'roles:needs-1', 'Lui demander qui seront ses chefs d’équipe.'],
    [
      '0:37',
      '5 min',
      'Démarrage et accompagnement',
      'needs:end-1',
      'Remettre les fiches imprimées et la liste de démarrage. Fixer une date.',
    ],
    ['0:42', '…', 'Questions', 'end', 'Noter chaque question : elles serviront pour la formation.'],
  ]

  // Programme (diapo 2), liste de démarrage et fiches : aussi visibles en présentation.
  const insertAfter = (id: string, ...items: Slide[]) => list.splice(list.findIndex((s) => s.id === id) + 1, 0, ...items)
  insertAfter('cover', {
    id: 'agenda',
    body: (
      <>
        <div className="pxp-kicker">Notre programme</div>
        <h3>Le déroulé de la réunion</h3>
        <div className="pxp-agenda">
          {agenda.map(([when, duration, what]) => (
            <div key={when}>
              <b>{when}</b>
              <span>{what}</span>
              <em>{duration}</em>
            </div>
          ))}
        </div>
      </>
    ),
    notes: `Présenter le programme : on sait où l'on va, et le client sait quand il pourra poser ses questions.`,
  })
  insertAfter('needs', {
    id: 'checklist',
    body: (
      <>
        <div className="pxp-kicker">La liste de démarrage</div>
        <h3>À préparer ensemble</h3>
        <ul className="pxp-slide-check">
          {start.map((s) => (
            <li key={s.title}>
              <b>{s.title}</b>
              <span>{s.text}</span>
            </li>
          ))}
        </ul>
      </>
    ),
    notes: `Parcourir la liste avec le client et noter qui, chez lui, s'occupe de chaque point.`,
  })
  insertAfter(
    'support',
    ...sheets.flatMap((sheet) => {
      const steps = sheet.steps.map((step, i) => ({ ...step, n: i + 1 }))
      const count = Math.ceil(steps.length / 5)
      const size = Math.ceil(steps.length / count)
      const parts = Array.from({ length: count }, (_, i) => steps.slice(i * size, i * size + size))
      return parts.map((part, k): Slide => ({
        body: (
          <>
            <div className="pxp-kicker">
              Fiche {sheet.role}
              {parts.length > 1 ? ` · ${k + 1}/${parts.length}` : ''}
            </div>
            <h3>{sheet.title}</h3>
            <div className="pxp-slide-steps" style={{ '--pxp-cols': size } as CSSProperties}>
              {part.map((step) => (
                <div key={step.n}>
                  <div className={`pxp-shot ${step.image ? (step.tall ? 'pxp-tall' : '') : 'pxp-empty'}`}>
                    {step.image ? <img src={step.image} alt="" loading="lazy" /> : <span aria-hidden>📲</span>}
                  </div>
                  <div className="pxp-step-title">
                    <span className="pxp-n">{step.n}</span>
                    {step.title}
                  </div>
                  <p>{step.text}</p>
                </div>
              ))}
            </div>
          </>
        ),
        notes: `Montrer la fiche imprimée en même temps : c'est exactement la même chose, à garder près de soi.`,
      }))
    }),
  )

  const at = (ref: string) => {
    const [id, offset] = ref.split('-')
    return list.findIndex((s) => s.id === id) + 1 - (offset ? Number(offset) : 0)
  }
  const screen = (ref: string) => {
    if (!ref) return 'App PerformX'
    const [a, b] = ref.split(':')
    if (!b) return `Diapo ${at(a)}`
    const range = at(a) === at(b) ? `Diapo ${at(a)}` : `Diapos ${at(a)} à ${at(b)}`
    return a === 'dashboard' ? `${range}, puis performx.online` : range
  }
  const run = agenda.map(([when, duration, what, ref, tip]) => ({ when, duration, what, screen: screen(ref), tip }))

  return {
    name,
    slides: list.map((slide) => ({ ...slide, body: typo(slide.body), notes: frenchSpaces(slide.notes) })),
    sheets: sheets.map((sheet) => ({
      ...sheet,
      subtitle: frenchSpaces(sheet.subtitle),
      steps: sheet.steps.map((step) => ({ ...step, text: typo(step.text) })),
      help: sheet.help.map(frenchSpaces),
    })),
    run: run.map((r) => ({ ...r, what: frenchSpaces(r.what), tip: frenchSpaces(r.tip) })),
    start: start.map((item) => ({ title: frenchSpaces(item.title), text: frenchSpaces(item.text) })),
  }
}
