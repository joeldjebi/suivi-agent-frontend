import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Appareils réalistes construits en CSS : MacBook (écran, encoche, socle aluminium) et
 * iPhone (cadre titane, Dynamic Island, boutons, reflet du verre).
 */
export function MacBook({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative mx-auto w-full', className)}>
      {/* Écran */}
      <div className="relative mx-auto w-[86%] rounded-t-[1.4rem] bg-[#0d0d0f] p-[1.1%] shadow-[0_50px_100px_-30px_rgba(0,0,0,0.55)] ring-1 ring-black/60">
        <div className="absolute top-0 left-1/2 z-20 h-[3.2%] w-[11%] -translate-x-1/2 rounded-b-xl bg-[#0d0d0f]" aria-hidden />
        <div className="relative aspect-[16/10] overflow-hidden rounded-[0.55rem] bg-white">
          {children}
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0)_38%)]"
            aria-hidden
          />
        </div>
      </div>
      {/* Socle */}
      <div
        className="relative h-[clamp(10px,1.6vw,20px)] w-full rounded-b-[45%_100%] bg-gradient-to-b from-[#e4e5e9] via-[#c9cbd1] to-[#9a9ca3] shadow-[0_18px_30px_-12px_rgba(0,0,0,0.45)]"
        aria-hidden
      >
        <div className="absolute top-0 left-1/2 h-[42%] w-[15%] -translate-x-1/2 rounded-b-lg bg-gradient-to-b from-[#b7b9bf] to-[#d6d8dd]" />
      </div>
    </div>
  )
}

export function IPhone({ children, className, dark }: { children: ReactNode; className?: string; dark?: boolean }) {
  return (
    <div className={cn('relative mx-auto aspect-[71.6/147.6] w-full max-w-[18rem]', className)}>
      {/* Boutons latéraux */}
      <span className="absolute top-[18%] -left-[1.2%] h-[6%] w-[1.6%] rounded-l bg-[#6e6e73]" aria-hidden />
      <span className="absolute top-[27%] -left-[1.2%] h-[10%] w-[1.6%] rounded-l bg-[#6e6e73]" aria-hidden />
      <span className="absolute top-[39%] -left-[1.2%] h-[10%] w-[1.6%] rounded-l bg-[#6e6e73]" aria-hidden />
      <span className="absolute top-[30%] -right-[1.2%] h-[14%] w-[1.6%] rounded-r bg-[#6e6e73]" aria-hidden />
      {/* Cadre titane */}
      <div className="absolute inset-0 rounded-[17%/8.2%] bg-[linear-gradient(145deg,#9a9a9f_0%,#4a4a4f_30%,#2c2c2e_55%,#6e6e73_100%)] p-[1.6%] shadow-[0_40px_80px_-24px_rgba(0,0,0,0.6)]">
        <div className="relative size-full overflow-hidden rounded-[15.5%/7.4%] bg-black p-[3.2%]">
          <div
            className={cn(
              'relative size-full overflow-hidden rounded-[13%/6.2%]',
              dark ? 'bg-black text-white' : 'bg-[#f2f2f7] text-neutral-900',
            )}
          >
            <div className="absolute top-[1.6%] left-1/2 z-30 h-[3.9%] w-[33%] -translate-x-1/2 rounded-full bg-black" aria-hidden />
            {children}
          </div>
          <div
            className="pointer-events-none absolute inset-0 rounded-[15.5%/7.4%] bg-[linear-gradient(120deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0)_30%,rgba(255,255,255,0)_70%,rgba(255,255,255,0.05)_100%)]"
            aria-hidden
          />
        </div>
      </div>
    </div>
  )
}

/** Barre d'état iOS. */
export function StatusBar({ dark }: { dark?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-[8%] pt-[4.2%] text-[clamp(8px,0.75vw,11px)] font-semibold',
        dark ? 'text-white' : 'text-neutral-900',
      )}
      aria-hidden
    >
      <span>9:41</span>
      <span className="flex items-center gap-1">
        <svg viewBox="0 0 18 12" className="h-[0.8em]" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="7" rx="1" />
          <rect x="10" y="2.5" width="3" height="9.5" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg viewBox="0 0 26 12" className="h-[0.85em]" fill="none" stroke="currentColor">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" strokeOpacity="0.4" />
          <rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" stroke="none" />
          <path d="M24 4v4" strokeLinecap="round" strokeOpacity="0.5" />
        </svg>
      </span>
    </div>
  )
}
