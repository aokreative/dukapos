import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Smartphone, Lock, AlertTriangle, Sparkles, Loader2, Check } from 'lucide-react'
import { useStore } from '../store/useStore'
import { evaluateBilling } from '../lib/billing'
import { getPlan, priceFor } from '../lib/plans'
import { money, displayPhone, isValidPhone } from '../lib/format'

import { Modal } from './ui'
import type { BillingCycle, PlanId } from '../types'

/** Re-render every minute so the billing status stays current. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function useBilling() {
  const subscription = useStore((s) => s.subscription)
    const now = useNow()
  // When connected to the backend, the server is the source of truth.
  const billing = evaluateBilling(subscription, now)
  return { billing, subscription }
}

export function PaySubscriptionModal({
  planId,
  cycle = 'monthly',
  open,
  onClose,
  }: {
  planId: PlanId
  cycle?: BillingCycle
  open: boolean
  onClose: () => void
  }) {
  const settings = useStore((s) => s.settings)
        const plan = getPlan(planId)
  const amount = priceFor(plan, cycle)
  const [phone, setPhone] = useState(displayPhone(settings.phone))
  const [state, setState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle')
  const [detail, setDetail] = useState('')
  // True when the server confirmed WITHOUT moving real money (no Daraja keys).
  
  
  
  async function pay() {
    if (!isValidPhone(phone)) return
    setState('pending')
    setDetail('Processing...')
    // IntaSend integration deferred
    setTimeout(() => {
      setState('error')
      setDetail('Online payment is currently unavailable. Please contact support.')
    }, 1500)
  }

  return (
    <Modal open={open} onClose={state === 'pending' ? () => {} : onClose} title="Pay subscription">
      <div className="rounded-2xl bg-brand-50 p-4 text-center dark:bg-brand-900">
        <div className="text-xs uppercase tracking-wide text-brand-900/50 dark:text-white/50">{plan.name} plan · {cycle === 'annual' ? 'annual' : 'monthly'}</div>
        <div className="text-3xl font-black text-brand-700 dark:text-gold-400">{money(amount)}</div>
        {cycle === 'annual' && <div className="text-xs font-semibold text-green-600 dark:text-green-400">12 months for the price of 10</div>}
      </div>

      {state === 'done' ? (
        false ? (
          <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-center dark:bg-amber-500/10">
            <AlertTriangle size={36} className="mx-auto text-amber-500" />
            {!useStore((s) => s.tenantId) && (
              <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">
                Sign in via cloud sync to manage your subscription.
              </p>
            )}
            <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">
              This server has no M-PESA (Daraja) keys yet, so payments are simulated for demos.
              The account is marked active for testing only. Add your Daraja keys on the server
              (MPESA_CONSUMER_KEY, SECRET, SHORTCODE, PASSKEY) to collect real subscriptions into your till.
            </p>
          </div>
        ) : (
          <div className="mt-5 flex flex-col items-center gap-2 py-4 text-green-600 dark:text-green-400">
            <Check size={40} />
            <p className="font-semibold">Payment received — account active for 30 days.</p>
          </div>
        )
      ) : (
        <>
          <div className="mt-4">
            <label className="label">M-PESA phone number</label>
            <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={state === 'pending'} />
            {phone && !isValidPhone(phone) && <p className="mt-1 text-xs text-red-600">Enter a valid Kenyan number</p>}
          </div>
          {detail && (
            <p className={`mt-3 text-sm ${state === 'error' ? 'text-red-600' : 'text-brand-900/60 dark:text-white/60'}`}>{detail}</p>
          )}
          <button className="btn-primary mt-4 w-full text-lg" onClick={pay} disabled={!isValidPhone(phone) || state === 'pending'}>
            {state === 'pending' ? <Loader2 className="animate-spin" size={20} /> : <Smartphone size={20} />}
            {state === 'pending' ? 'Waiting for payment…' : `Pay ${money(amount)} with M-PESA`}
          </button>
          {true && (
            <p className="mt-2 text-center text-xs text-brand-900/40 dark:text-white/40">
              Demo mode — payment is simulated. Set VITE_API_URL to collect real M-PESA.
            </p>
          )}
        </>
      )}
    </Modal>
  )
}

/** Slim banner shown above the app while the subscription needs attention. */
export function BillingBanner() {
  const { billing } = useBilling()
  const navigate = useNavigate()
  const [payOpen, setPayOpen] = useState(false)

  if (billing.status === 'active') return null
  if (billing.status === 'suspended') return null // handled by full Paywall

  const config = {
    trial: {
      color: 'bg-blue-600',
      icon: <Sparkles size={16} />,
      text: `Free trial — ${billing.trialDaysLeft} day${billing.trialDaysLeft === 1 ? '' : 's'} left`,
      cta: 'Choose a plan',
    },
    grace: {
      color: 'bg-amber-500',
      icon: <AlertTriangle size={16} />,
      text: `Payment due — pay within ${7 - billing.overdueDays + 1} day(s) to avoid a hold`,
      cta: 'Pay now',
    },
    restricted: {
      color: 'bg-red-600',
      icon: <Lock size={16} />,
      text: 'Account on hold — selling is paused until you pay',
      cta: 'Pay now',
    },
  }[billing.status]!

  return (
    <>
      <div className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white ${config.color}`}>
        {config.icon}
        <span className="flex-1">{config.text}</span>
        <button
          className="rounded-lg bg-white/20 px-3 py-1 text-xs font-bold hover:bg-white/30"
          onClick={() => (billing.status === 'trial' ? navigate('/subscription') : setPayOpen(true))}
        >
          {config.cta}
        </button>
      </div>
      <PaySubscriptionModal planId={billing.planId} open={payOpen} onClose={() => setPayOpen(false)}  />
    </>
  )
}

/** Full-screen paywall when the account is suspended for non-payment. */
export function Paywall() {
  const { billing } = useBilling()
  const [payOpen, setPayOpen] = useState(false)
  const plan = getPlan(billing.planId)
  if (!billing.locked) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-900/95 p-6 backdrop-blur">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-brand-800">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-500/20">
          <Lock size={26} />
        </div>
        <h2 className="text-xl font-black text-brand-900 dark:text-white">Account suspended</h2>
        <p className="mt-2 text-sm text-brand-900/60 dark:text-white/60">
          Your subscription payment is {billing.overdueDays} days overdue, so the POS is locked. Your data is safe —
          pay to reactivate instantly.
        </p>
        <div className="mt-4 rounded-2xl bg-brand-50 p-4 dark:bg-brand-900">
          <div className="text-xs uppercase tracking-wide text-brand-900/50 dark:text-white/50">{plan.name} plan</div>
          <div className="text-2xl font-black text-brand-700 dark:text-gold-400">{money(plan.price)}/mo</div>
        </div>
        <button className="btn-primary mt-4 w-full text-lg" onClick={() => setPayOpen(true)}>
          <Smartphone size={20} /> Pay & reactivate
        </button>
      </div>
      <PaySubscriptionModal planId={billing.planId} open={payOpen} onClose={() => setPayOpen(false)}  />
    </div>
  )
}
