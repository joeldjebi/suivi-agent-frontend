import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { buildPresentation, type PresentationModel, type Slide } from './model'
import type { PresentationContent } from './types'
import './presentation.css'

const PARTS = [
  { id: 'slides', label: 'Diaporama' },
  { id: 'sheets', label: 'Fiches' },
  { id: 'run', label: 'Déroulé' },
  { id: 'start', label: 'Démarrage' },
] as const
type Part = (typeof PARTS)[number]['id']

/** Logo PerformX (blanc), sur les couvertures. */
function Mark() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden>
      <path d="M16 52C16 40 48 43 48 32S16 23 16 12" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" />
      <circle cx="16" cy="52" r="7" fill="#fff" />
      <circle cx="16" cy="12" r="9" fill="#fff" />
    </svg>
  )
}

function SlideCard({ slide, index, total, name }: { slide: Slide; index: number; total: number; name: string }) {
  const visual = slide.phone ? (
    <div className="pxp-phone">
      <img src={slide.phone} alt="" loading="lazy" />
    </div>
  ) : slide.screen ? (
    <div className="pxp-screen">
      <img src={slide.screen} alt="" loading="lazy" />
    </div>
  ) : null
  return (
    <section className={`pxp-slide ${slide.cover ? 'pxp-cover' : ''}`} aria-label={`Diapositive ${index + 1} sur ${total}`}>
      <div className="pxp-inner">
        {slide.cover && (
          <div className="pxp-pair">
            <span className="pxp-chip">
              <Mark />
            </span>
            PerformX <span className="pxp-x">×</span> {name}
          </div>
        )}
        {visual ? (
          <div className={`pxp-split ${slide.screen ? 'pxp-wide' : ''}`}>
            <div>{slide.body}</div>
            {visual}
          </div>
        ) : (
          slide.body
        )}
      </div>
      {!slide.cover && <div className="pxp-mark">PerformX · {name}</div>}
      <div className="pxp-num">
        {index + 1} / {total}
      </div>
    </section>
  )
}

/** Fiches par rôle (A4), affichées dans la page et seules à l'impression. */
function Sheets({ sheets }: { sheets: PresentationModel['sheets'] }) {
  return (
    <>
      {sheets.map((sheet) => (
        <article key={sheet.role} className="pxp-sheet">
          <div className="pxp-sheet-head">
            <span className="pxp-badge">{sheet.role}</span>
            <div>
              <h3>{sheet.title}</h3>
              <p>{sheet.subtitle}</p>
            </div>
          </div>
          <div className="pxp-how">
            {sheet.steps.map((step, i) => (
              <div key={step.title}>
                <header>
                  <span className="pxp-n">{i + 1}</span>
                  {step.title}
                </header>
                {step.image && (
                  <div className={`pxp-shot ${step.tall ? 'pxp-tall' : ''}`}>
                    <img src={step.image} alt="" />
                  </div>
                )}
                <p>{step.text}</p>
              </div>
            ))}
          </div>
          <div className="pxp-help">
            <h4>En cas de souci</h4>
            <ul>
              {sheet.help.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
        </article>
      ))}
    </>
  )
}

/** Plein écran : flèches, espace ou clic pour avancer ; N pour les notes ; Échap pour sortir. */
function Stage({ slides, name, withNotes, onClose }: { slides: Slide[]; name: string; withNotes: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState(0)
  const [notes, setNotes] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const go = useCallback((delta: number) => setCurrent((i) => Math.max(0, Math.min(slides.length - 1, i + delta))), [slides.length])

  useEffect(() => {
    const stage = ref.current
    stage?.focus()
    stage?.requestFullscreen?.().catch(() => {})
    const left = () => {
      if (!document.fullscreenElement) onClose()
    }
    document.addEventListener('fullscreenchange', left)
    return () => {
      document.removeEventListener('fullscreenchange', left)
      if (document.fullscreenElement) void document.exitFullscreen?.()
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="pxp-stage"
      tabIndex={-1}
      role="dialog"
      aria-label="Présentation en plein écran"
      onKeyDown={(e) => {
        if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(e.key)) go(1)
        else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) go(-1)
        else if (e.key === 'Home') setCurrent(0)
        else if (e.key === 'End') setCurrent(slides.length - 1)
        else if (withNotes && e.key.toLowerCase() === 'n') setNotes((v) => !v)
        else if (e.key === 'Escape') onClose()
        else return
        e.preventDefault()
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.pxp-notes, .pxp-stage-close')) return
        go(e.clientX > window.innerWidth / 3 ? 1 : -1)
      }}
    >
      <button type="button" className="pxp-stage-close" onClick={onClose}>
        Quitter
      </button>
      <div className="pxp-stage-hint">← → pour naviguer{withNotes ? ' · N : notes' : ''} · Échap : quitter</div>
      <SlideCard slide={slides[current]} index={current} total={slides.length} name={name} />
      {notes && (
        <div className="pxp-notes">
          <b>À dire :</b> {slides[current].notes}
        </div>
      )}
    </div>
  )
}

/**
 * Présentation complète d'un client : diaporama, fiches à imprimer, déroulé et liste de
 * démarrage. Sert d'aperçu dans la console éditeur et de page ouverte par le lien partagé ;
 * `forPresenter` ajoute ce qui ne regarde que le présentateur (déroulé, notes « À dire »).
 */
export function PresentationView({ content, forPresenter = true }: { content: PresentationContent; forPresenter?: boolean }) {
  const showRun = forPresenter
  const model = useMemo(() => buildPresentation(content), [content])
  const [presenting, setPresenting] = useState(false)
  const [active, setActive] = useState<Part>('slides')
  const parts = useRef<Partial<Record<Part, HTMLElement | null>>>({})
  const clicked = useRef<number>(0)
  const visible = useMemo(() => PARTS.filter((p) => showRun || p.id !== 'run'), [showRun])
  const close = useCallback(() => setPresenting(false), [])

  // Onglet actif : la dernière partie dont le titre est passé sous la barre.
  useEffect(() => {
    const sync = () => {
      if (Date.now() - clicked.current < 1200) return
      let id: Part = 'slides'
      for (const p of visible) {
        const el = parts.current[p.id]
        if (el && el.getBoundingClientRect().top <= 140) id = p.id
      }
      setActive(id)
    }
    document.addEventListener('scroll', sync, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', sync, { capture: true })
  }, [visible])

  // Impression : les fiches seules, dans une zone placée directement dans <body> (le reste est masqué).
  const [printing, setPrinting] = useState(false)
  useEffect(() => {
    if (!printing) return
    const done = () => setPrinting(false)
    window.addEventListener('afterprint', done)
    document.body.classList.add('pxp-printing')
    // Laisse les images de la zone se charger avant d'ouvrir la fenêtre d'impression.
    const timer = window.setTimeout(() => window.print(), 300)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', done)
      document.body.classList.remove('pxp-printing')
    }
  }, [printing])
  const brand = { '--pxp-brand': content.color } as CSSProperties

  return (
    <div className="pxp" style={brand}>
      <div className="pxp-toolbar">
        <strong>PerformX × {model.name}</strong>
        <div className="pxp-tabs" role="navigation" aria-label="Parties de la présentation">
          {visible.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-current={active === p.id}
              onClick={() => {
                clicked.current = Date.now()
                setActive(p.id)
                parts.current[p.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="pxp-actions">
          <button type="button" className="pxp-primary" onClick={() => setPresenting(true)}>
            ▶ Présenter
          </button>
          <button type="button" onClick={() => setPrinting(true)}>
            Imprimer les fiches
          </button>
        </div>
      </div>

      <div className="pxp-main">
        <section className="pxp-part" ref={(el) => void (parts.current.slides = el)}>
          <h2>1. Le diaporama</h2>
          <p className="pxp-hint">
            « Présenter » ouvre le plein écran : flèches ou espace pour avancer{forPresenter ? ', N pour afficher les notes' : ''}, Échap
            pour sortir.
          </p>
          <div className="pxp-slides">
            {model.slides.map((slide, i) => (
              <SlideCard key={i} slide={slide} index={i} total={model.slides.length} name={model.name} />
            ))}
          </div>
        </section>

        <section className="pxp-part" ref={(el) => void (parts.current.sheets = el)}>
          <h2>2. Les fiches « pas à pas »</h2>
          <p className="pxp-hint">Une fiche par rôle, à imprimer et à garder près de soi. « Imprimer les fiches » les sort une par page.</p>
          <Sheets sheets={model.sheets} />
        </section>

        {showRun && (
          <section className="pxp-part" ref={(el) => void (parts.current.run = el)}>
            <h2>3. Le déroulé de la démonstration</h2>
            <p className="pxp-hint">
              Pour le présentateur : quoi montrer, sur quel écran, et quoi dire. Environ 45 minutes, questions comprises.
            </p>
            <div className="pxp-table-scroll">
              <table className="pxp-run">
                <thead>
                  <tr>
                    <th>Quand</th>
                    <th>Durée</th>
                    <th>Quoi</th>
                    <th>Écran</th>
                    <th>Conseil</th>
                  </tr>
                </thead>
                <tbody>
                  {model.run.map((r) => (
                    <tr key={r.when}>
                      <td>{r.when}</td>
                      <td>{r.duration}</td>
                      <td>{r.what}</td>
                      <td>{r.screen}</td>
                      <td>{r.tip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="pxp-part" ref={(el) => void (parts.current.start = el)}>
          <h2>{showRun ? '4' : '3'}. La liste de démarrage</h2>
          <p className="pxp-hint">Ce que vous nous donnez, et ce que nous configurons ensemble, avant la formation des équipes.</p>
          <ul className="pxp-check">
            {model.start.map((s) => (
              <li key={s.title}>
                <div>
                  <b>{s.title}</b>
                  <span>{s.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {printing &&
        createPortal(
          <div className="pxp pxp-print-root" style={brand}>
            <Sheets sheets={model.sheets} />
          </div>,
          document.body,
        )}
      {presenting && <Stage slides={model.slides} name={model.name} withNotes={forPresenter} onClose={close} />}
    </div>
  )
}
