/**
 * Annonce « sync » du serveur : le sujet modifié (premier segment de l'adresse de l'API) et
 * les données du site qui en dépendent (racines des clés de requête). Seules les requêtes
 * affichées sont relues ; un sujet inconnu relit les données du même nom.
 */
const RELATED: Record<string, string[]> = {
  days: ['days', 'live', 'track', 'stats', 'reports', 'alerts', 'zone-exits'],
  missions: ['missions', 'stats', 'form-stats', 'insights', 'outlets', 'outlet-visit', 'photos', 'photo-analysis', 'impact'],
  outlets: ['outlets', 'outlet-visit', 'missions', 'stats'],
  orders: ['orders', 'outlets', 'stats', 'insights', 'van-sales', 'stock'],
  'van-sales': ['van-sales', 'stock', 'orders', 'outlets', 'stats', 'live'],
  stock: ['stock', 'van-sales'],
  products: ['products', 'product-suggestions', 'insights', 'stock', 'orders'],
  'product-suggestions': ['product-suggestions', 'products'],
  'zone-requests': ['zone-requests', 'zones', 'live'],
  zones: ['zones', 'live', 'outlets'],
  safety: ['alerts', 'live'],
  alerts: ['alerts', 'live'],
  users: ['users', 'groups', 'team-leads', 'live'],
  groups: ['groups', 'users', 'zones', 'team-leads'],
  'team-leads': ['team-leads', 'users', 'groups'],
  pay: ['pay'],
  settings: ['settings', 'setup', 'outlets'],
  'mission-types': ['mission-types', 'missions', 'form-stats'],
}

export function queryRootsFor(topic: string): string[] {
  return RELATED[topic] ?? [topic]
}
