import { CheckCircle2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api'

/** Demande de démo : un conseiller rappelle la structure. */
export function DemoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const empty = { name: '', organization: '', email: '', phone: '', agents: '', message: '', website: '' }
  const [v, setV] = useState(empty)
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)
  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((x) => ({ ...x, [key]: e.target.value }))
  const close = () => {
    onClose()
    if (state === 'sent') {
      setV(empty)
      setState('idle')
    }
  }
  const valid =
    v.name.trim().length >= 2 &&
    v.organization.trim().length >= 2 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email.trim()) &&
    v.phone.trim().length >= 8

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setState('sending')
    setError(null)
    try {
      await axios.post('/api/public/demo-requests', {
        name: v.name,
        organization: v.organization,
        email: v.email,
        phone: v.phone,
        agents: v.agents ? Number(v.agents) : undefined,
        message: v.message || undefined,
        website: v.website || undefined,
      })
      setState('sent')
    } catch (err) {
      setError(errorMessage(err))
      setState('idle')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        {state === 'sent' ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-12 text-status-active" aria-hidden />
            <DialogTitle>Merci, c’est noté !</DialogTitle>
            <DialogDescription>Un conseiller vous appelle très vite pour organiser votre démonstration.</DialogDescription>
            <Button className="mt-2" onClick={close}>
              Fermer
            </Button>
          </div>
        ) : (
          <form onSubmit={(e) => void submit(e)} noValidate>
            <DialogHeader>
              <DialogTitle>Demander une démo</DialogTitle>
              <DialogDescription>
                30 minutes avec un conseiller, sur vos cas concrets. Nous vous rappelons sous 24 h ouvrées.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="demo-name">Nom</Label>
                <Input id="demo-name" autoComplete="name" value={v.name} onChange={set('name')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="demo-org">Structure</Label>
                <Input id="demo-org" autoComplete="organization" value={v.organization} onChange={set('organization')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="demo-email">Email</Label>
                <Input id="demo-email" type="email" autoComplete="email" value={v.email} onChange={set('email')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="demo-phone">Téléphone</Label>
                <Input id="demo-phone" type="tel" autoComplete="tel" placeholder="07 07 07 07 07" value={v.phone} onChange={set('phone')} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="demo-agents">Nombre d’agents terrain (environ)</Label>
                <Input
                  id="demo-agents"
                  inputMode="numeric"
                  value={v.agents}
                  onChange={(e) => setV({ ...v, agents: e.target.value.replace(/\D/g, '') })}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="demo-message">Votre besoin (facultatif)</Label>
                <Textarea id="demo-message" rows={3} maxLength={1000} value={v.message} onChange={set('message')} />
              </div>
              {/* Champ piège pour les robots : invisible et ignoré par les lecteurs d'écran. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
                value={v.website}
                onChange={set('website')}
              />
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="mt-5 w-full" disabled={!valid || state === 'sending'}>
              {state === 'sending' && <Loader2 className="animate-spin" aria-hidden />}
              Envoyer ma demande
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
