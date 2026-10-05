import type { BentoTile, BentoVisual, LandingSection, LandingSectionType } from '@suivi/shared'
import { AreaField, CtaField, ListField, SelectField, TextField, ToggleField, VisualField } from './fields'

/** Nom de chaque type de section dans l'éditeur. */
export const SECTION_TYPES: Record<LandingSectionType, string> = {
  statement: 'Déclaration (mots révélés au défilement)',
  bento: 'Grille de tuiles (bento)',
  stats: 'Chiffres clés',
  feature: 'Fonctionnalité illustrée',
  story: 'Récit au défilement (téléphone)',
  audiences: 'Profils (cartes)',
  pricing: 'Tarifs (catalogue)',
  testimonials: 'Témoignages',
  faq: 'Questions fréquentes',
  cta: 'Appel à l’action final',
}

const ICONS = {
  smartphone: 'Téléphone',
  users: 'Équipe',
  'layout-dashboard': 'Tableau de bord',
  map: 'Carte',
  target: 'Cible',
  wallet: 'Portefeuille',
  shield: 'Bouclier',
  sparkles: 'Étoiles',
} as const

const BENTO_VISUALS: Record<BentoVisual, string> = {
  map: 'Carte en direct',
  offline: 'Hors connexion',
  alerts: 'Alertes',
  payroll: 'Rémunération',
  missions: 'Anneaux d’objectifs',
  security: 'Sécurité',
  devices: 'Mobile et web',
  chart: 'Statistiques',
}
const BENTO_SIZES: Record<BentoTile['size'], string> = {
  large: 'Grande (2 × 2)',
  wide: 'Large (2 × 1)',
  tall: 'Haute (1 × 2)',
  small: 'Petite',
}

/** Section neuve, prête à remplir. */
export function newSection(type: LandingSectionType, taken: string[]): LandingSection {
  let id: string = type
  for (let i = 2; taken.includes(id); i++) id = `${type}-${i}`
  const base = { id, enabled: true }
  switch (type) {
    case 'statement':
      return { ...base, type, text: 'Une phrase forte sur votre promesse.', emphasis: 'Et sa conclusion mise en couleur.' }
    case 'bento':
      return {
        ...base,
        type,
        eyebrow: 'Tout en un',
        title: 'Un titre court.',
        tiles: [
          { title: 'Carte en temps réel', text: 'Ce que la tuile montre.', visual: 'map', size: 'large' },
          { title: 'Statistiques', text: 'Ce que la tuile montre.', visual: 'chart', size: 'small' },
        ],
      }
    case 'stats':
      return { ...base, type, items: [{ value: '100 %', label: 'Votre chiffre clé' }] }
    case 'feature':
      return {
        ...base,
        type,
        eyebrow: 'Fonctionnalité',
        title: 'Un titre court\net fort.',
        text: 'Décrivez ce que la fonctionnalité change pour vos clients.',
        bullets: ['Premier avantage'],
        visual: 'dashboard',
        imageId: null,
        layout: 'right',
      }
    case 'story':
      return {
        ...base,
        type,
        eyebrow: 'Étape par étape',
        title: 'Un titre court.',
        steps: [
          { title: 'Première étape', text: 'Ce qui se passe.' },
          { title: 'Deuxième étape', text: 'Ce qui se passe ensuite.' },
        ],
      }
    case 'audiences':
      return {
        ...base,
        type,
        eyebrow: 'Pour qui',
        title: 'Un titre court.',
        items: [{ title: 'Profil', text: 'Ce qu’il y gagne.', icon: 'users' }],
      }
    case 'pricing':
      return { ...base, type, eyebrow: 'Tarifs', title: 'Nos formules', subtitle: '' }
    case 'testimonials':
      return {
        ...base,
        type,
        title: 'Ils nous font confiance.',
        items: [{ quote: 'Votre témoignage.', author: 'Prénom Nom', role: 'Fonction, structure' }],
      }
    case 'faq':
      return { ...base, type, title: 'Questions fréquentes', items: [{ question: 'Votre question ?', answer: 'Votre réponse.' }] }
    case 'cta':
      return {
        ...base,
        type,
        title: 'Prêt à commencer ?',
        text: '',
        primary: { label: 'Commencer l’essai gratuit', action: 'signup' },
        secondary: null,
      }
  }
}

/** Titre lisible d'une section dans la liste. */
export function sectionTitle(s: LandingSection): string {
  if ('title' in s && s.title) return s.title.replace(/\n/g, ' ')
  return SECTION_TYPES[s.type]
}

/** Formulaire propre à chaque type de section. */
export function SectionEditor({ section, onChange }: { section: LandingSection; onChange: (s: LandingSection) => void }) {
  const common = (
    <TextField
      label="Lien dans le menu du site (facultatif)"
      value={section.navLabel ?? ''}
      max={24}
      hint="Vide : la section n’apparaît pas dans le menu."
      onChange={(navLabel) => onChange({ ...section, navLabel: navLabel || undefined })}
    />
  )
  const titleHint = 'Un retour à la ligne crée une nouvelle ligne du grand titre.'
  switch (section.type) {
    case 'statement':
      return (
        <>
          <AreaField label="Phrase" rows={3} value={section.text} max={240} onChange={(text) => onChange({ ...section, text })} />
          <AreaField
            label="Fin de phrase en couleur"
            rows={2}
            value={section.emphasis}
            max={120}
            onChange={(emphasis) => onChange({ ...section, emphasis })}
          />
          {common}
        </>
      )
    case 'bento':
      return (
        <>
          <TextField label="Surtitre" value={section.eyebrow} max={60} onChange={(eyebrow) => onChange({ ...section, eyebrow })} />
          <AreaField
            label="Titre"
            rows={2}
            value={section.title}
            max={120}
            hint={titleHint}
            onChange={(title) => onChange({ ...section, title })}
          />
          <ListField<BentoTile>
            label="Tuiles"
            items={section.tiles}
            max={8}
            create={() => ({ title: 'Nouvelle tuile', text: 'Ce qu’elle montre.', visual: 'chart', size: 'small' })}
            onChange={(tiles) => onChange({ ...section, tiles })}
            render={(tile, update) => (
              <>
                <TextField label="Titre" value={tile.title} max={60} onChange={(title) => update({ ...tile, title })} />
                <AreaField label="Texte" rows={2} value={tile.text} max={200} onChange={(text) => update({ ...tile, text })} />
                <div className="grid grid-cols-2 gap-2">
                  <SelectField
                    label="Scène"
                    value={tile.visual}
                    options={BENTO_VISUALS}
                    onChange={(visual) => update({ ...tile, visual })}
                  />
                  <SelectField label="Taille" value={tile.size} options={BENTO_SIZES} onChange={(size) => update({ ...tile, size })} />
                </div>
              </>
            )}
          />
          {common}
        </>
      )
    case 'stats':
      return (
        <>
          <ListField
            label="Chiffres"
            items={section.items}
            max={6}
            create={() => ({ value: '0', label: 'Libellé' })}
            onChange={(items) => onChange({ ...section, items })}
            render={(item, update) => (
              <div className="grid grid-cols-[6rem_1fr] gap-2">
                <TextField label="Valeur" value={item.value} max={12} onChange={(value) => update({ ...item, value })} />
                <TextField label="Libellé" value={item.label} max={80} onChange={(label) => update({ ...item, label })} />
              </div>
            )}
          />
          {common}
        </>
      )
    case 'feature':
      return (
        <>
          <TextField label="Surtitre" value={section.eyebrow} max={60} onChange={(eyebrow) => onChange({ ...section, eyebrow })} />
          <AreaField
            label="Titre"
            rows={2}
            value={section.title}
            max={120}
            hint={titleHint}
            onChange={(title) => onChange({ ...section, title })}
          />
          <AreaField label="Texte" value={section.text} max={600} onChange={(text) => onChange({ ...section, text })} />
          <ListField
            label="Points forts"
            items={section.bullets}
            max={6}
            create={() => 'Nouvel avantage'}
            onChange={(bullets) => onChange({ ...section, bullets })}
            render={(b, update) => <TextField label="Texte" value={b} max={160} onChange={update} />}
          />
          <VisualField
            visual={section.visual}
            imageId={section.imageId}
            onChange={(visual, imageId) => onChange({ ...section, visual, imageId })}
          />
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="Illustration"
              value={section.layout}
              options={{ right: 'À droite', left: 'À gauche' }}
              onChange={(layout) => onChange({ ...section, layout })}
            />
            <div className="flex items-end pb-1.5">
              <ToggleField label="Fond sombre" checked={!!section.dark} onChange={(dark) => onChange({ ...section, dark })} />
            </div>
          </div>
          {common}
        </>
      )
    case 'story':
      return (
        <>
          <TextField label="Surtitre" value={section.eyebrow} max={60} onChange={(eyebrow) => onChange({ ...section, eyebrow })} />
          <AreaField
            label="Titre"
            rows={2}
            value={section.title}
            max={120}
            hint={titleHint}
            onChange={(title) => onChange({ ...section, title })}
          />
          <ListField
            label="Étapes (l’écran du téléphone suit : zone, journée, formulaire, gains)"
            items={section.steps}
            max={6}
            create={() => ({ title: 'Étape', text: 'Ce qui se passe.' })}
            onChange={(steps) => onChange({ ...section, steps })}
            render={(step, update) => (
              <>
                <TextField label="Titre" value={step.title} max={80} onChange={(title) => update({ ...step, title })} />
                <AreaField label="Texte" rows={2} value={step.text} max={400} onChange={(text) => update({ ...step, text })} />
              </>
            )}
          />
          {common}
        </>
      )
    case 'audiences':
      return (
        <>
          <TextField label="Surtitre" value={section.eyebrow} max={60} onChange={(eyebrow) => onChange({ ...section, eyebrow })} />
          <AreaField
            label="Titre"
            rows={2}
            value={section.title}
            max={120}
            hint={titleHint}
            onChange={(title) => onChange({ ...section, title })}
          />
          <ListField
            label="Cartes"
            items={section.items}
            max={6}
            create={() => ({ title: 'Profil', text: 'Ce qu’il y gagne.', icon: 'users' })}
            onChange={(items) => onChange({ ...section, items })}
            render={(item, update) => (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <TextField label="Titre" value={item.title} max={80} onChange={(title) => update({ ...item, title })} />
                  <SelectField
                    label="Icône"
                    value={(item.icon ?? 'sparkles') as keyof typeof ICONS}
                    options={ICONS}
                    onChange={(icon) => update({ ...item, icon })}
                  />
                </div>
                <AreaField label="Texte" rows={2} value={item.text} max={400} onChange={(text) => update({ ...item, text })} />
              </>
            )}
          />
          {common}
        </>
      )
    case 'pricing':
      return (
        <>
          <TextField label="Surtitre" value={section.eyebrow} max={60} onChange={(eyebrow) => onChange({ ...section, eyebrow })} />
          <AreaField
            label="Titre"
            rows={2}
            value={section.title}
            max={120}
            hint={titleHint}
            onChange={(title) => onChange({ ...section, title })}
          />
          <AreaField
            label="Sous-titre"
            rows={2}
            value={section.subtitle}
            max={300}
            onChange={(subtitle) => onChange({ ...section, subtitle })}
          />
          <p className="rounded-md bg-muted px-2.5 py-2 text-[11px] text-muted-foreground">
            Les formules, leurs prix et leurs avantages viennent du catalogue (page Formules) : toujours à jour.
          </p>
          {common}
        </>
      )
    case 'testimonials':
      return (
        <>
          <AreaField label="Titre" rows={2} value={section.title} max={120} onChange={(title) => onChange({ ...section, title })} />
          <ListField
            label="Témoignages"
            items={section.items}
            max={9}
            create={() => ({ quote: 'Votre témoignage.', author: 'Prénom Nom', role: '' })}
            onChange={(items) => onChange({ ...section, items })}
            render={(t, update) => (
              <>
                <AreaField label="Citation" rows={2} value={t.quote} max={400} onChange={(quote) => update({ ...t, quote })} />
                <div className="grid grid-cols-2 gap-2">
                  <TextField label="Auteur" value={t.author} max={60} onChange={(author) => update({ ...t, author })} />
                  <TextField label="Fonction" value={t.role} max={80} onChange={(role) => update({ ...t, role })} />
                </div>
              </>
            )}
          />
          {common}
        </>
      )
    case 'faq':
      return (
        <>
          <TextField label="Titre" value={section.title} max={120} onChange={(title) => onChange({ ...section, title })} />
          <ListField
            label="Questions"
            items={section.items}
            max={20}
            create={() => ({ question: 'Votre question ?', answer: 'Votre réponse.' })}
            onChange={(items) => onChange({ ...section, items })}
            render={(q, update) => (
              <>
                <TextField label="Question" value={q.question} max={160} onChange={(question) => update({ ...q, question })} />
                <AreaField label="Réponse" rows={3} value={q.answer} max={800} onChange={(answer) => update({ ...q, answer })} />
              </>
            )}
          />
          {common}
        </>
      )
    case 'cta':
      return (
        <>
          <AreaField
            label="Titre"
            rows={2}
            value={section.title}
            max={120}
            hint={titleHint}
            onChange={(title) => onChange({ ...section, title })}
          />
          <AreaField label="Texte" rows={2} value={section.text} max={300} onChange={(text) => onChange({ ...section, text })} />
          <CtaField label="Bouton principal" value={section.primary} onChange={(primary) => onChange({ ...section, primary })} />
          <ToggleField
            label="Second bouton"
            checked={!!section.secondary}
            onChange={(on) => onChange({ ...section, secondary: on ? { label: 'Parler à un conseiller', action: 'demo' } : null })}
          />
          {section.secondary && (
            <CtaField label="Second bouton" value={section.secondary} onChange={(secondary) => onChange({ ...section, secondary })} />
          )}
          {common}
        </>
      )
  }
}
