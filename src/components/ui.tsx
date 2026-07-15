import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white/85 p-5 shadow-xl ring-1 ring-white/50 backdrop-blur-2xl dark:bg-brand-800/85 dark:ring-white/10 sm:rounded-3xl ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        }`}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-brand-900 dark:text-white">{title}</h2>
            <button className="rounded-full p-1.5 text-brand-900/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
        )}
        {children}
        {footer && <div className="mt-5 flex gap-2">{footer}</div>}
      </div>
    </div>
  )
}

export function Badge({ color = 'gray', children }: { color?: 'gray' | 'green' | 'red' | 'amber' | 'blue' | 'gold'; children: ReactNode }) {
  const map: Record<string, string> = {
    gray: 'bg-black/5 text-brand-900/70 dark:bg-white/10 dark:text-white/70',
    green: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
    gold: 'bg-gold-500/20 text-gold-600 dark:text-gold-400',
  }
  return <span className={`chip ${map[color]}`}>{children}</span>
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-black/10 p-10 text-center dark:border-white/10">
      {icon && <div className="mb-3 text-brand-500/60">{icon}</div>}
      <div className="font-semibold text-brand-900 dark:text-white">{title}</div>
      {hint && <div className="mt-1 max-w-xs text-sm text-brand-900/50 dark:text-white/50">{hint}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-brand-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-sm text-brand-900/50 dark:text-white/50">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
