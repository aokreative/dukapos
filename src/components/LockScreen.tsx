import { useState, useEffect } from 'react'
import { Delete, ShieldCheck, UserMinus } from 'lucide-react'
import { useStore } from '../store/useStore'
import { ROLE_LABEL } from '../lib/permissions'
import type { StaffMember } from '../types'

export default function LockScreen() {
  const shopName = useStore((s) => s.settings.name)
  const staff = useStore((s) => s.staff.filter((m) => m.active))
  const login = useStore((s) => s.staffLogin)

  const [selected, setSelected] = useState<StaffMember | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  function press(d: string) {
    if (pin.length >= 6) return
    const next = pin + d
    setPin(next)
    setError(false)
    if (next.length >= 4 && selected) {
      // Try as soon as it could be valid (4–6 digits).
      if (next === selected.pin) {
        login(selected.id, next)
      }
    }
  }

  function submit() {
    if (!selected) return
    if (!login(selected.id, pin)) {
      setError(true)
      setPin('')
    }
  }

  useEffect(() => {
    if (!selected) return
    
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') {
        press(e.key)
      } else if (e.key === 'Backspace') {
        setPin((p) => p.slice(0, -1))
        setError(false)
      } else if (e.key === 'Enter') {
        if (pin.length >= 4) {
          submit()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selected, pin])

  return (
    <div className="flex h-full flex-col items-center justify-center bg-brand-900 px-6 py-10 text-white">
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-black text-gold-400">
          {shopName.charAt(0).toUpperCase() || 'D'}
        </div>
        <div className="text-xl font-black tracking-tight">{shopName || 'Duka'}</div>
        <div className="text-sm text-white/50">
          {selected ? `Enter ${selected.name}'s PIN` : 'Who is on the till?'}
        </div>
      </div>

      {!selected ? (
        <div className="grid w-full max-w-xs grid-cols-1 gap-2">
          {staff.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelected(m)}
              className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-left transition hover:bg-white/15 active:scale-[0.99]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500 font-bold text-brand-900">
                {m.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{m.name}</div>
                <div className="text-xs text-white/50">{ROLE_LABEL[m.role]}</div>
              </div>
            </button>
          ))}
          {staff.length === 0 && (
            <p className="rounded-xl bg-white/10 p-4 text-center text-sm text-white/60">
              No active staff. Restore demo data from another device or reinstall.
            </p>
          )}
        </div>
      ) : (
        <div className="flex w-full max-w-xs flex-col items-center">
          <div className={`mb-6 flex gap-3 ${error ? 'animate-pulse' : ''}`}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={`h-3.5 w-3.5 rounded-full border ${
                  i < pin.length ? 'border-gold-400 bg-gold-400' : 'border-white/30'
                } ${i >= 4 && pin.length < 4 ? 'opacity-30' : ''}`}
              />
            ))}
          </div>
          {error && <div className="mb-3 text-sm font-semibold text-red-300">Wrong PIN — try again</div>}

          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                onClick={() => press(d)}
                className="h-16 w-16 rounded-full bg-white/10 text-2xl font-semibold transition hover:bg-white/20 active:scale-95"
              >
                {d}
              </button>
            ))}
            <button onClick={() => { setSelected(null); setPin(''); setError(false) }} className="flex flex-col h-16 w-16 items-center justify-center rounded-full text-white/60 hover:bg-white/10" aria-label="Switch User">
              <UserMinus size={20} />
              <span className="text-[9px] mt-0.5 uppercase tracking-wider font-bold">Switch</span>
            </button>
            <button onClick={() => press('0')} className="h-16 w-16 rounded-full bg-white/10 text-2xl font-semibold transition hover:bg-white/20 active:scale-95">
              0
            </button>
            <button onClick={() => { setPin((p) => p.slice(0, -1)); setError(false) }} className="flex h-16 w-16 items-center justify-center rounded-full text-white/60 hover:bg-white/10" aria-label="Delete">
              <Delete size={22} />
            </button>
          </div>

          {pin.length >= 4 && (
            <button onClick={submit} className="btn-gold mt-6 w-full py-4 text-lg rounded-xl shadow-lg shadow-gold-500/20">
              Unlock
            </button>
          )}
        </div>
      )}

      <div className="mt-10 flex items-center gap-1.5 text-xs text-white/30">
        <ShieldCheck size={13} /> Demo PINs — Owner 1234 · Cashier 0000
      </div>
    </div>
  )
}
