import { execSync } from 'node:child_process'
import path from 'node:path'

/**
 * Données de démonstration remises à zéro avant les tests, TOUJOURS dans la base Docker locale.
 * Un tunnel SSH vers la production écoute souvent sur localhost:5434 (même port que la base
 * locale) : on passe donc par l'adresse réseau du Mac, que le tunnel n'intercepte pas, et on
 * refuse de continuer si un tunnel SSH écoute sur ce port.
 */
function localDatabaseHost(): string {
  const fromEnv = process.env.DATABASE_HOST
  if (fromEnv && !['localhost', '127.0.0.1', '::1'].includes(fromEnv)) return fromEnv
  for (const iface of ['en0', 'en1']) {
    try {
      const ip = execSync(`ipconfig getifaddr ${iface}`, { encoding: 'utf8' }).trim()
      if (ip) return ip
    } catch {
      // interface absente
    }
  }
  throw new Error('Adresse réseau du Mac introuvable : lancez les tests avec DATABASE_HOST=<adresse IP locale>.')
}

function assertNoTunnel(port: string) {
  let listeners = ''
  try {
    listeners = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN`, { encoding: 'utf8' })
  } catch {
    return // personne n'écoute, ou lsof indisponible
  }
  if (/^ssh\s/m.test(listeners))
    throw new Error(
      `Un tunnel SSH écoute sur le port ${port} (base de production ?). Fermez-le avant de lancer les tests : ` +
        'la préparation des tests efface la base.',
    )
}

export default function globalSetup() {
  const port = process.env.DATABASE_PORT ?? '5434'
  assertNoTunnel(port)
  execSync('npm run seed -- --reset', {
    cwd: path.resolve(import.meta.dirname, '../../backend'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_HOST: localDatabaseHost(), DATABASE_PORT: port },
  })
}
