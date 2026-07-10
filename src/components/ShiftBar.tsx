// Cashier shifts: start the day by declaring "cash at hand" (the float),
// close it with "Close desk" — the app reconciles expected vs counted cash
// and files the shift into the day's records (synced across devices).
import { useState } from 'react'
import { Sunrise, DoorClosed, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Modal } from './ui'
import { useStore, selectOpenShift, selectCurrentStaff } from '../store/useStore'
import { money } from '../lib/format'
import type { Shift } from '../types'

export default function ShiftBar() {
  const staff = useStore(selectCurrentStaff)
  const openShift = useStore(selectOpenShift)
  const openShiftAction = useStore((s) => s.openShift)
  const currency = useStore((s) => s.settings.currency)
  const [float, setFloat] = useState('')
  const [closing, setClosing] = useState(false)

  if (!staff) return null

  // The close-desk modal renders independent of the shift's open/closed state,
  // so its reconciliation result survives after the shift is closed.
  return (
    <>
      {!openShift ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-500/20 dark:bg-amber-500/10">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <Sunrise size={15} /> {staff.name}, start your day — cash at hand:
          </span>
          <input
            className="w-28 rounded-lg border border-amber-300 bg-white px-2 py-1 text-sm dark:border-amber-500/30 dark:bg-white/10 dark:text-white"
            inputMode="decimal"
            placeholder="e.g. 500"
            value={float}
            onChange={(e) => setFloat(e.target.value)}
          />
          <button
            className="rounded-lg bg-amber-500 px-3 py-1 text-sm font-bold text-white hover:bg-amber-600"
            onClick={() => {
              openShiftAction(parseFloat(float) || 0)
              setFloat('')
            }}
          >
            Start shift
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 border-b border-black/5 bg-green-50 px-4 py-1.5 text-xs dark:border-white/10 dark:bg-green-500/10">
          <span className="text-green-800 dark:text-green-300">
            ● On shift since {new Date(openShift.openedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })} · float {money(openShift.openingCash, currency)}
          </span>
          <button className="flex items-center gap-1 font-bold text-green-800 underline dark:text-green-300" onClick={() => setClosing(true)}>
            <DoorClosed size={13} /> Close desk
          </button>
        </div>
      )}
      {closing && <CloseDeskModal onClose={() => setClosing(false)} />}
    </>
  )
}

function CloseDeskModal({ onClose }: { onClose: () => void }) {
  const currency = useStore((s) => s.settings.currency)
  const closeShift = useStore((s) => s.closeShift)
  const logout = useStore((s) => s.logout)
  const [counted, setCounted] = useState('')
  const [result, setResult] = useState<Shift | null>(null)

  if (result) {
    const ok = Math.abs(result.variance ?? 0) < 1
    return (
      <Modal open onClose={onClose} title="Desk closed ✓">
        <div className="rounded-2xl bg-brand-50 p-4 text-center dark:bg-brand-900">
          {ok ? (
            <CheckCircle2 className="mx-auto mb-1 text-green-600" size={28} />
          ) : (
            <AlertTriangle className="mx-auto mb-1 text-amber-500" size={28} />
          )}
          <div className="text-sm text-brand-900/60 dark:text-white/60">
            {result.txCount} sale{result.txCount === 1 ? '' : 's'} · {money(result.totalSales ?? 0, currency)} total
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-white/70 py-2 dark:bg-white/10">
              <div className="text-[10px] uppercase text-brand-900/50 dark:text-white/50">Cash expected</div>
              <div className="font-black text-brand-900 dark:text-white">{money(result.expectedCash ?? 0, currency)}</div>
            </div>
            <div className="rounded-xl bg-white/70 py-2 dark:bg-white/10">
              <div className="text-[10px] uppercase text-brand-900/50 dark:text-white/50">Counted</div>
              <div className="font-black text-brand-900 dark:text-white">{money(result.countedCash ?? 0, currency)}</div>
            </div>
          </div>
          <div className={`mt-2 text-sm font-bold ${ok ? 'text-green-700 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {ok ? 'Drawer balances perfectly ✓' : `${(result.variance ?? 0) > 0 ? 'Over' : 'Short'} by ${money(Math.abs(result.variance ?? 0), currency)}`}
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-brand-900/40 dark:text-white/40">
          Saved & synced — the owner sees this in the close-of-business report.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="btn-ghost" onClick={onClose}>Stay signed in</button>
          <button className="btn-primary" onClick={() => { onClose(); logout() }}>Sign out</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} title="Close desk">
      <p className="mb-3 text-sm text-brand-900/60 dark:text-white/60">
        Count the cash in your drawer (including your float) and enter the total. The app checks it against what it expected.
      </p>
      <label className="label">Cash counted in drawer ({currency})</label>
      <input autoFocus className="input" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0" />
      <button
        className="btn-primary mt-4 w-full"
        disabled={counted.trim() === ''}
        onClick={() => {
          const r = closeShift(parseFloat(counted) || 0)
          if (r) setResult(r)
          else onClose()
        }}
      >
        <DoorClosed size={17} /> Close my desk
      </button>
    </Modal>
  )
}
