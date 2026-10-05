import { execSync } from 'node:child_process'
import path from 'node:path'

export default function globalSetup() {
  execSync('npm run seed -- --reset', {
    cwd: path.resolve(import.meta.dirname, '../../backend'),
    stdio: 'inherit',
  })
}
