import type { PublicLanding } from '@suivi/shared'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'

const UPDATED = '17 octobre 2026'

/** Nom et adresse de contact réglés dans la console éditeur (repli si indisponibles). */
function useContact() {
  const query = useQuery({
    queryKey: ['public', 'landing'],
    queryFn: async () => (await axios.get<PublicLanding>('/api/public/landing')).data,
    retry: false,
  })
  const name = query.data?.content.brand.name || 'PerformX'
  const emails = query.data?.content.footer.emails ?? []
  const phones = query.data?.content.footer.phones ?? []
  return { name, emails, phones }
}

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  const { name } = useContact()
  useEffect(() => {
    const previous = document.title
    document.title = `${title} · ${name}`
    return () => {
      document.title = previous
    }
  }, [title, name])
  return (
    <div className="min-h-svh bg-white text-[#1d1d1f]">
      <header className="border-b border-black/10 px-5 py-4">
        <div className="mx-auto max-w-[760px]">
          <Link to="/" className="text-[15px] font-semibold tracking-tight">
            {name}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[760px] px-5 py-10 text-[15px] leading-relaxed text-[#424245] [&_h2]:mt-9 [&_h2]:mb-3 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:text-[#1d1d1f] [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        <h1 className="text-[32px] leading-tight font-semibold tracking-tight text-[#1d1d1f]">{title}</h1>
        <p className="text-[13px] text-[#6e6e73]">Dernière mise à jour : {UPDATED}</p>
        {children}
      </main>
    </div>
  )
}

function ContactLine() {
  const { emails } = useContact()
  if (emails.length === 0) return <span>l'adresse indiquée en bas de la page d'accueil</span>
  return (
    <>
      {emails.map((email, i) => (
        <span key={email}>
          {i > 0 && (i === emails.length - 1 ? ' ou ' : ', ')}
          <a href={`mailto:${email}`} className="font-medium text-[#1d1d1f] underline">
            {email}
          </a>
        </span>
      ))}
    </>
  )
}

/** Politique de confidentialité de l'application mobile et de l'espace web. */
export function PrivacyPage() {
  const { name } = useContact()
  return (
    <LegalLayout title="Politique de confidentialité">
      <p>
        {name} est un outil de suivi du travail de terrain. Une entreprise (la « structure ») l'utilise pour organiser le travail de ses
        agents et chefs d'équipe. Cette page explique quelles données l'application collecte, pourquoi, et comment exercer vos droits.
      </p>

      <h2>Qui est responsable de vos données</h2>
      <p>
        La structure qui vous a créé un compte est responsable du traitement : c'est elle qui décide des missions, des zones et de la durée
        de conservation. {name} héberge et traite les données pour son compte, uniquement pour faire fonctionner le service.
      </p>

      <h2>Données collectées</h2>
      <ul>
        <li>
          <strong>Identité et compte</strong> : nom, numéro de téléphone, rôle, groupe. Ces informations sont saisies par votre structure.
          Le mot de passe est conservé sous forme chiffrée irréversible.
        </li>
        <li>
          <strong>Position</strong> : uniquement entre le début et la fin de la journée de travail que vous lancez vous-même dans
          l'application, y compris lorsque l'application est en arrière-plan ou l'écran éteint. Avec chaque position : précision, vitesse,
          niveau de batterie et détection d'une position simulée. Aucune position n'est collectée en dehors d'une journée en cours.
        </li>
        <li>
          <strong>Photos</strong> : celles que vous prenez dans l'application (visites, rayons, points de vente), avec l'heure et le lieu de
          la prise de vue.
        </li>
        <li>
          <strong>Données de travail</strong> : présence et pauses, missions, réponses aux formulaires, points de vente, commandes et
          paiements enregistrés.
        </li>
        <li>
          <strong>Appareil</strong> : jeton de notification, système (Android ou iOS) et version de l'application.
        </li>
      </ul>

      <h2>Utilisation</h2>
      <p>
        Ces données servent uniquement à : afficher l'activité de l'équipe à vos responsables, vérifier la présence dans les zones de
        travail, calculer les statistiques et la paie définies par votre structure, et vous envoyer des notifications liées au travail.
      </p>
      <p>Aucune publicité. Aucune revente ni cession de données. Aucun outil de traçage publicitaire.</p>

      <h2>Partage avec des prestataires</h2>
      <ul>
        <li>Firebase Cloud Messaging (Google) et Apple Push Notification service : envoi des notifications.</li>
        <li>OpenStreetMap : affichage des fonds de carte (votre téléphone télécharge les images de carte).</li>
        <li>Notre hébergeur, pour le stockage sur des serveurs sécurisés.</li>
      </ul>
      <p>Seuls les membres de votre structure autorisés par leur rôle voient vos données.</p>

      <h2>Conservation</h2>
      <p>
        Les positions sont supprimées automatiquement après la durée fixée par votre structure (365 jours par défaut). Les autres données
        sont conservées tant que votre compte existe, puis supprimées avec lui.
      </p>

      <h2>Sécurité</h2>
      <p>
        Les échanges sont chiffrés (HTTPS). Les accès sont limités selon le rôle, les tentatives de connexion répétées sont bloquées et
        l'application peut être verrouillée par code ou biométrie.
      </p>

      <h2>Vos droits</h2>
      <p>
        Conformément à la loi ivoirienne n° 2013-450 relative à la protection des données à caractère personnel, vous pouvez demander
        l'accès, la rectification ou la suppression de vos données. Adressez-vous à l'administrateur de votre structure, ou écrivez-nous à{' '}
        <ContactLine />. Vous pouvez aussi saisir l'ARTCI.
      </p>
      <p>
        Pour supprimer votre compte, voir la page{' '}
        <Link to="/suppression-compte" className="font-medium text-[#1d1d1f] underline">
          Suppression de compte
        </Link>
        .
      </p>

      <h2>Permissions de l'application</h2>
      <ul>
        <li>Position (y compris en arrière-plan) : suivi pendant la journée de travail.</li>
        <li>Appareil photo : photos des visites et des rayons.</li>
        <li>Notifications : missions, commandes, messages de la structure, alertes.</li>
        <li>Biométrie : déverrouiller l'application, si vous l'activez.</li>
      </ul>
      <p>Vous pouvez retirer chaque permission dans les réglages du téléphone.</p>
    </LegalLayout>
  )
}

/** Demande de suppression du compte et des données (exigée par les stores). */
export function AccountDeletionPage() {
  const { name } = useContact()
  return (
    <LegalLayout title="Suppression de compte">
      <p>
        Les comptes {name} sont créés par votre structure (votre employeur ou donneur d'ordre). Vous pouvez demander la suppression de votre
        compte et de vos données à tout moment.
      </p>

      <h2>Comment faire</h2>
      <ul>
        <li>
          <strong>Auprès de votre structure</strong> : demandez à son administrateur de supprimer votre compte depuis l'espace web
          (Utilisateurs, puis Supprimer). La suppression est immédiate.
        </li>
        <li>
          <strong>Auprès de nous</strong> : écrivez à <ContactLine /> en indiquant votre nom, votre numéro de téléphone et le nom de votre
          structure. Après vérification de votre identité, la demande est traitée sous 30 jours.
        </li>
      </ul>

      <h2>Données supprimées</h2>
      <ul>
        <li>Votre compte et vos accès (déconnexion de tous vos appareils).</li>
        <li>Vos journées de travail, positions et pauses.</li>
        <li>Vos réponses aux formulaires, photos et missions individuelles.</li>
        <li>Vos appareils enregistrés pour les notifications.</li>
      </ul>

      <h2>Données conservées</h2>
      <p>
        Les données que votre structure doit garder pour ses obligations légales ou comptables (par exemple des commandes ou des paiements)
        peuvent être conservées par elle, sans lien avec un compte actif, pour la durée imposée par la loi.
      </p>
    </LegalLayout>
  )
}

/** Assistance : contact et réponses aux questions fréquentes (URL d'assistance des stores). */
export function SupportPage() {
  const { name, phones } = useContact()
  return (
    <LegalLayout title="Assistance">
      <p>Une question sur l'application {name}, un problème de connexion ou une suggestion ? Nous vous répondons du lundi au vendredi.</p>

      <h2>Nous contacter</h2>
      <ul>
        <li>
          E-mail : <ContactLine />
        </li>
        {phones.map((phone) => (
          <li key={phone}>
            Téléphone :{' '}
            <a href={`tel:${phone.replace(/\s/g, '')}`} className="font-medium text-[#1d1d1f] underline">
              {phone}
            </a>
          </li>
        ))}
        <li>Administrateurs de structure : la rubrique Assistance de votre espace web permet aussi d'ouvrir une demande.</li>
      </ul>

      <h2>Questions fréquentes</h2>
      <p>
        <strong>Comment obtenir un compte ?</strong> Les comptes sont créés par votre entreprise. Demandez vos identifiants à votre
        responsable ou à l'administrateur de votre structure.
      </p>
      <p>
        <strong>J'ai oublié mon mot de passe.</strong> Demandez à l'administrateur de votre structure de le réinitialiser depuis l'espace
        web.
      </p>
      <p>
        <strong>Ma position n'est pas partagée.</strong> Autorisez la localisation « Toujours » pour {name} dans les réglages du téléphone,
        puis démarrez votre journée. La position n'est utilisée que pendant la journée de travail.
      </p>
      <p>
        <strong>Je ne reçois pas les notifications.</strong> Vérifiez qu'elles sont autorisées pour {name} dans les réglages du téléphone.
      </p>
      <p>
        <strong>Je n'ai pas de réseau.</strong> Continuez à travailler : visites et commandes sont gardées sur le téléphone et envoyées dès
        le retour de la connexion.
      </p>

      <h2>Liens utiles</h2>
      <ul>
        <li>
          <Link to="/confidentialite" className="font-medium text-[#1d1d1f] underline">
            Politique de confidentialité
          </Link>
        </li>
        <li>
          <Link to="/suppression-compte" className="font-medium text-[#1d1d1f] underline">
            Suppression de compte
          </Link>
        </li>
      </ul>
    </LegalLayout>
  )
}
