import { OnboardingAnimation } from '@suivi/shared'

/** Animations fournies avec l'app (copie dans /public/onboarding, générées par scripts/onboarding-lottie.py). */
export const ANIMATIONS: Record<OnboardingAnimation, { label: string; file: string }> = {
  [OnboardingAnimation.Location]: { label: 'Localisation', file: '/onboarding/location.json' },
  [OnboardingAnimation.Missions]: { label: 'Missions', file: '/onboarding/missions.json' },
  [OnboardingAnimation.Team]: { label: 'Équipe', file: '/onboarding/team.json' },
}

/** Couleur par défaut de l'app (sans couleur d'accent choisie). */
export const APP_COLOR = '#2563EB'

type Json = Record<string, unknown>

/**
 * Applique la couleur d'accent aux formes nommées « accent » (comme l'app mobile). Les
 * animations importées sans formes « accent » restent inchangées.
 */
export function recolor(data: Json, hex: string): Json {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const copy = structuredClone(data)
  const paint = (items: Json[], inAccent: boolean) => {
    for (const item of items) {
      const accent = inAccent || item.nm === 'accent'
      if (item.ty === 'gr') paint(item.it as Json[], accent)
      else if (accent && (item.ty === 'fl' || item.ty === 'st')) {
        const c = item.c as { a: number; k: number[] }
        if (c.a === 0) c.k = [...rgb, c.k[3] ?? 1]
      }
    }
  }
  for (const layer of (copy.layers as Json[] | undefined) ?? []) {
    if (layer.shapes) paint(layer.shapes as Json[], false)
  }
  return copy
}
