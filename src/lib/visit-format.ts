/** Drapeau emoji à partir d'un code pays ISO à 2 lettres (ex. "CI" → 🇨🇮). */
export function drapeau(code: string | null | undefined): string {
  const cc = (code ?? '').toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return ''
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

let regionNames: Intl.DisplayNames | null = null
/** Nom du pays en français à partir du code ISO. */
export function paysNom(code: string | null | undefined): string {
  const cc = (code ?? '').toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return ''
  try {
    regionNames ??= new Intl.DisplayNames(['fr'], { type: 'region' })
    return regionNames.of(cc) ?? cc
  } catch {
    return cc
  }
}

/** Type d'appareil et système à partir du user-agent. */
export function appareil(ua: string | null | undefined): { type: string; os: string } {
  const s = (ua ?? '').toLowerCase()
  let os = 'Inconnu'
  if (/ipad/.test(s)) os = 'iPad'
  else if (/iphone|ipod/.test(s)) os = 'iPhone'
  else if (/android/.test(s)) os = 'Android'
  else if (/windows/.test(s)) os = 'Windows'
  else if (/mac os x|macintosh/.test(s)) os = 'macOS'
  else if (/linux/.test(s)) os = 'Linux'
  const tablet = /ipad|tablet/.test(s)
  const mobile = /mobile|iphone|ipod/.test(s) || (/android/.test(s) && /mobile/.test(s))
  const type = tablet ? 'Tablette' : mobile ? 'Téléphone' : os === 'Inconnu' ? 'Inconnu' : 'Ordinateur'
  return { type, os }
}

const SOURCES: Record<string, string> = {
  google: 'Google',
  bing: 'Bing',
  'duckduckgo': 'DuckDuckGo',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  'lnkd': 'LinkedIn',
  whatsapp: 'WhatsApp',
  't.co': 'Twitter/X',
  'x.com': 'Twitter/X',
  twitter: 'Twitter/X',
  telegram: 'Telegram',
}

/** Provenance lisible à partir du référent (ex. google.com → « Google »). */
export function provenance(ref: string | null | undefined, selfHost?: string): string {
  if (!ref) return 'Lien direct'
  try {
    const h = new URL(ref).hostname.replace(/^www\./, '')
    if (selfHost && h === selfHost.replace(/^www\./, '')) return 'Lien direct'
    for (const key in SOURCES) if (h.includes(key)) return SOURCES[key]
    return h
  } catch {
    return 'Lien direct'
  }
}
