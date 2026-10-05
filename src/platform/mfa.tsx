import { CheckCircle2, Copy, Download, KeyRound, Loader2, ShieldCheck, ShieldOff } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { StatusPill } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { platformApi } from './api'
import { usePlatformAdmin, usePlatformAuth } from './auth'
import type { PlatformSession } from './types'

interface Setup {
  secret: string
  otpauthUrl: string
  qrCode: string
}

/** Champ du code à 6 chiffres. */
function CodeInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="123456"
      className="max-w-40 text-center font-mono text-lg tracking-[0.4em]"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
    />
  )
}

/** Codes de secours : affichés une seule fois, à copier ou télécharger. */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const text = codes.join('\n')
  const download = () => {
    const url = URL.createObjectURL(new Blob([`Codes de secours Suivi Agent (console éditeur)\n\n${text}\n`], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'codes-de-secours-suivi-agent.txt'
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        <strong>Gardez ces codes en lieu sûr</strong> (gestionnaire de mots de passe, coffre). Chacun permet une connexion si vous perdez
        votre téléphone. Ils ne seront plus affichés.
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 font-mono text-sm sm:grid-cols-4">
        {codes.map((c) => (
          <li key={c} className="text-center">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void navigator.clipboard.writeText(text).then(
              () => toast.success('Codes copiés'),
              () => toast.error('Copie impossible : téléchargez-les'),
            )
          }
        >
          <Copy aria-hidden /> Copier
        </Button>
        <Button variant="outline" size="sm" onClick={download}>
          <Download aria-hidden /> Télécharger
        </Button>
        <Button size="sm" className="ml-auto" onClick={onDone}>
          J’ai enregistré mes codes
        </Button>
      </div>
    </div>
  )
}

/** Mise en place : QR code à scanner, puis premier code pour confirmer. */
export function MfaSetupFlow({ onCancel }: { onCancel?: () => void }) {
  const { adopt } = usePlatformAuth()
  const [setup, setSetup] = useState<Setup | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ session: PlatformSession; codes: string[] } | null>(null)

  const start = async () => {
    setBusy(true)
    try {
      setSetup((await platformApi.post<Setup>('/auth/mfa/setup')).data)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const confirm = async () => {
    setBusy(true)
    try {
      const { data } = await platformApi.post<PlatformSession & { recoveryCodes: string[] }>('/auth/mfa/enable', { code })
      setDone({ session: data, codes: data.recoveryCodes })
    } catch (e) {
      toast.error(errorMessage(e))
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  if (done)
    return (
      <div className="flex flex-col gap-3">
        <p className="flex items-center gap-2 font-medium text-status-active">
          <CheckCircle2 className="size-4" aria-hidden /> Double authentification activée
        </p>
        <RecoveryCodes
          codes={done.codes}
          onDone={() => {
            toast.success('Votre compte est protégé par la double authentification')
            void adopt(done.session)
          }}
        />
      </div>
    )

  if (!setup)
    return (
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void start()}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />}
          Activer la double authentification
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Plus tard
          </Button>
        )}
      </div>
    )

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <img
        src={setup.qrCode}
        alt="QR code à scanner avec l’application d’authentification"
        className="size-44 shrink-0 rounded-lg border bg-white p-1"
      />
      <div className="flex min-w-0 flex-col gap-3 text-sm">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Ouvrez Google Authenticator, Microsoft Authenticator ou 1Password sur votre téléphone.</li>
          <li>Scannez le QR code (ou saisissez la clé ci-dessous).</li>
          <li>Entrez le code à 6 chiffres affiché pour confirmer.</li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Clé : <code className="rounded bg-muted px-1 py-0.5 break-all select-all">{setup.secret.match(/.{1,4}/g)?.join(' ')}</code>
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mfa-setup-code">Code de confirmation</Label>
          <div className="flex gap-2">
            <CodeInput id="mfa-setup-code" value={code} onChange={setCode} />
            <Button disabled={code.length !== 6 || busy} onClick={() => void confirm()}>
              Confirmer
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Carte « Double authentification » de la page Sécurité du compte. */
export function MfaCard() {
  const admin = usePlatformAdmin()
  const { adopt } = usePlatformAuth()
  const enabled = !!admin.mfaEnabledAt
  const [dialog, setDialog] = useState<'disable' | 'codes' | null>(null)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [codes, setCodes] = useState<string[] | null>(null)

  const close = () => {
    setDialog(null)
    setPassword('')
    setCode('')
  }
  const submit = async () => {
    setBusy(true)
    try {
      if (dialog === 'disable') {
        const { data } = await platformApi.post<PlatformSession>('/auth/mfa/disable', { password, code })
        toast.success('Double authentification désactivée')
        close()
        await adopt(data)
      } else {
        const { data } = await platformApi.post<{ recoveryCodes: string[] }>('/auth/mfa/recovery-codes', { code })
        close()
        setCodes(data.recoveryCodes)
      }
    } catch (e) {
      toast.error(errorMessage(e))
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <KeyRound className="size-4" aria-hidden /> Double authentification
        </h2>
        {enabled ? (
          <StatusPill tone="active" icon={ShieldCheck} label={`Active depuis le ${formatDate(admin.mfaEnabledAt)}`} />
        ) : (
          <StatusPill tone="paused" icon={ShieldOff} label="Inactive" />
        )}
      </div>
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm text-muted-foreground">
          À chaque connexion, en plus du mot de passe, un code à 6 chiffres généré par votre téléphone est demandé. Un mot de passe volé ne
          suffit plus pour entrer dans la console.
        </p>
        {codes ? (
          <RecoveryCodes codes={codes} onDone={() => setCodes(null)} />
        ) : enabled ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDialog('codes')}>
              Nouveaux codes de secours
            </Button>
            {!admin.mfaSetupRequired && (
              <Button variant="ghost" className="text-destructive" onClick={() => setDialog('disable')}>
                Désactiver
              </Button>
            )}
          </div>
        ) : (
          <MfaSetupFlow />
        )}
      </div>
      <Dialog open={dialog !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === 'disable' ? 'Désactiver la double authentification' : 'Nouveaux codes de secours'}</DialogTitle>
            <DialogDescription>
              {dialog === 'disable'
                ? 'Votre compte ne sera plus protégé que par le mot de passe. Confirmez avec votre mot de passe et un code.'
                : 'Les anciens codes de secours ne fonctionneront plus. Confirmez avec un code de l’application.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {dialog === 'disable' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mfa-password">Mot de passe</Label>
                <Input
                  id="mfa-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mfa-code">Code de l’application</Label>
              <CodeInput id="mfa-code" value={code} onChange={setCode} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Annuler
            </Button>
            <Button
              variant={dialog === 'disable' ? 'destructive' : 'default'}
              disabled={code.length !== 6 || (dialog === 'disable' && !password) || busy}
              onClick={() => void submit()}
            >
              {dialog === 'disable' ? 'Désactiver' : 'Générer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
