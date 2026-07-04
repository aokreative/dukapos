import { useMemo, useState } from 'react'
import { Check, Sparkles, Calculator, Smartphone, RefreshCw, Receipt as ReceiptIcon, ShieldCheck } from 'lucide-react'
import { useStore, selectUsage } from '../store/useStore'
import { PLANS, getPlan, recommendPlan, limitLabel, priceFor, type SizeInputs } from '../lib/plans'
import { STATUS_COLOR, STATUS_LABEL } from '../lib/billing'
import { money, shortDate } from '../lib/format'
import { PageHeader, Badge } from '../components/ui'
import { PaySubscriptionModal, useBilling } from '../components/Billing'
import type { BillingCycle, PlanId } from '../types'

export default function Subscription() {
  const { billing, subscription } = useBilling()
  const usage = useStore(selectUsage)
  const setAutoRenew = useStore((s) => s.setAutoRenew)
  const setPlan = useStore((s) => s.setPlan)
  const simulateBillingAge = useStore((s) => s.simulateBillingAge)

  const currentPlan = getPlan(subscription.planId)
  const [payFor, setPayFor] = useState<PlanId | null>(null)
  const [cycle, setCycle] = useState<BillingCycle>('monthly')
  const per = cycle === 'annual' ? '/yr' : '/mo'

  return (
    <div className="max-w-3xl">
      <PageHeader title="Subscription & Billing" subtitle="Duka POS is a subscription — pick the size that fits your shop." />

      {/* Billing cycle toggle */}
      <div className="mb-4 inline-flex rounded-xl bg-black/5 p-1 dark:bg-white/10">
        <button onClick={() => setCycle('monthly')} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${cycle === 'monthly' ? 'bg-white text-brand-900 shadow-sm dark:bg-brand-700 dark:text-white' : 'text-brand-900/60 dark:text-white/60'}`}>
          Monthly
        </button>
        <button onClick={() => setCycle('annual')} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${cycle === 'annual' ? 'bg-white text-brand-900 shadow-sm dark:bg-brand-700 dark:text-white' : 'text-brand-900/60 dark:text-white/60'}`}>
          Annual <span className="text-green-600 dark:text-green-400">−2 months</span>
        </button>
      </div>

      {/* Status card */}
      <div className="card mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-brand-900 dark:text-white">{currentPlan.name}</span>
              <span className="text-brand-900/40 dark:text-white/40">·</span>
              <span className="text-brand-900/60 dark:text-white/60">{currentPlan.swahili}</span>
              <Badge color={STATUS_COLOR[billing.status]}>{STATUS_LABEL[billing.status]}</Badge>
            </div>
            <div className="mt-1 text-sm text-brand-900/60 dark:text-white/60">
              {billing.status === 'trial'
                ? `Free trial — ${billing.trialDaysLeft} days left`
                : billing.status === 'active'
                  ? `Renews ${shortDate(billing.effectiveDue)}`
                  : `Due ${shortDate(billing.effectiveDue)} · ${billing.overdueDays} day(s) overdue`}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-brand-700 dark:text-gold-400">{money(priceFor(currentPlan, cycle))}</div>
            <div className="text-xs text-brand-900/50 dark:text-white/50">{cycle === 'annual' ? 'per year' : 'per month'}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn-primary" onClick={() => setPayFor(subscription.planId)}>
            <Smartphone size={18} /> {billing.status === 'trial' ? 'Subscribe now' : 'Pay now'}
          </button>
          <label className="flex items-center gap-2 rounded-xl bg-black/5 px-3 py-2.5 text-sm font-medium text-brand-900 dark:bg-white/10 dark:text-white">
            <RefreshCw size={15} /> Auto-renew
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={subscription.autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
          </label>
        </div>
      </div>

      {/* Usage vs limits */}
      <div className="card mb-5 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-900/60 dark:text-white/60">
          <ShieldCheck size={15} /> Your usage on the {currentPlan.name} plan
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <UsageBar label="Products" used={usage.products} limit={currentPlan.limits.products} />
          <UsageBar label="Sales this month" used={usage.monthlyTx} limit={currentPlan.limits.monthlyTx} />
          <UsageBar label="Shops" used={usage.shops} limit={currentPlan.limits.shops} />
          <UsageBar label="Staff" used={usage.staff} limit={currentPlan.limits.staff} />
        </div>
      </div>

      <SizeRecommender onChoose={(id) => setPayFor(id)} currentPlan={subscription.planId} onSetPlan={setPlan} cycle={cycle} />

      {/* Plans */}
      <h2 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wide text-brand-900/60 dark:text-white/60">All plans</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {PLANS.map((p) => {
          const current = p.id === subscription.planId
          return (
            <div key={p.id} className={`card p-5 ${current ? 'ring-2 ring-brand-500' : ''}`}>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="font-black text-brand-900 dark:text-white">{p.name}</div>
                  <div className="text-xs text-brand-900/50 dark:text-white/50">{p.swahili}</div>
                </div>
                {current && <Badge color="green">Current</Badge>}
              </div>
              <div className="mt-2 text-2xl font-black text-brand-700 dark:text-gold-400">
                {money(priceFor(p, cycle))}
                <span className="text-sm font-medium text-brand-900/40 dark:text-white/40">{per}</span>
              </div>
              {cycle === 'annual' && <div className="text-xs font-semibold text-green-600 dark:text-green-400">2 months free</div>}
              <p className="mt-1 text-sm text-brand-900/60 dark:text-white/60">{p.blurb}</p>
              <ul className="mt-3 space-y-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-brand-900/80 dark:text-white/80">
                    <Check size={15} className="mt-0.5 shrink-0 text-brand-600 dark:text-gold-400" /> {f}
                  </li>
                ))}
              </ul>
              <button className={`mt-4 w-full ${current ? 'btn-ghost' : 'btn-primary'}`} onClick={() => setPayFor(p.id)}>
                {current ? 'Renew this plan' : `Switch to ${p.name}`}
              </button>
            </div>
          )
        })}
      </div>

      {/* Invoices */}
      <h2 className="mb-3 mt-6 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-900/60 dark:text-white/60">
        <ReceiptIcon size={15} /> Payment history
      </h2>
      <div className="card p-2">
        {subscription.invoices.length === 0 ? (
          <p className="py-6 text-center text-sm text-brand-900/40 dark:text-white/40">No payments yet — you're on the free trial.</p>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/10">
            {subscription.invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-3 py-3">
                <div>
                  <div className="text-sm font-semibold text-brand-900 dark:text-white">{getPlan(inv.planId).name} · {inv.cycle === 'annual' ? 'Annual' : 'Monthly'} · {shortDate(inv.periodStart)} → {shortDate(inv.periodEnd)}</div>
                  <div className="text-xs text-brand-900/50 dark:text-white/50">{inv.method?.toUpperCase()}{inv.ref ? ` · ${inv.ref}` : ''}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-brand-900 dark:text-white">{money(inv.amount)}</div>
                  <Badge color="green">Paid</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Demo controls */}
      <div className="mt-6 rounded-2xl border border-dashed border-black/15 p-4 dark:border-white/15">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-900/40 dark:text-white/40">Demo · preview billing states</div>
        <p className="mb-3 text-xs text-brand-900/50 dark:text-white/50">See how the POS behaves as payment falls due. These just shift the demo dates.</p>
        <div className="flex flex-wrap gap-2">
          <button className="chip bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300" onClick={() => simulateBillingAge(0)}>Active</button>
          <button className="chip bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300" onClick={() => simulateBillingAge(3)}>Payment due (grace)</button>
          <button className="chip bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" onClick={() => simulateBillingAge(10)}>On hold</button>
          <button className="chip bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" onClick={() => simulateBillingAge(20)}>Suspended</button>
        </div>
      </div>

      {payFor && (
        <PaySubscriptionModal planId={payFor} cycle={cycle} open onClose={() => setPayFor(null)} onPaid={() => setPayFor(null)} />
      )}
    </div>
  )
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit === Infinity ? Math.min(100, used > 0 ? 8 : 0) : Math.min(100, (used / limit) * 100)
  const over = limit !== Infinity && used > limit
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-brand-900/70 dark:text-white/70">{label}</span>
        <span className={`font-semibold ${over ? 'text-red-600 dark:text-red-400' : 'text-brand-900 dark:text-white'}`}>
          {used.toLocaleString('en-KE')} / {limitLabel(limit)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-brand-600'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function SizeRecommender({ onChoose, currentPlan, onSetPlan, cycle }: { onChoose: (id: PlanId) => void; currentPlan: PlanId; onSetPlan: (id: PlanId) => void; cycle: BillingCycle }) {
  const [size, setSize] = useState<SizeInputs>({ shops: 1, staff: 2, products: 200, monthlyTx: 1000 })
  const rec = useMemo(() => recommendPlan(size), [size])

  const num = (k: keyof SizeInputs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSize((s) => ({ ...s, [k]: Math.max(0, parseInt(e.target.value) || 0) }))

  return (
    <div className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-bold text-brand-900 dark:text-white">
        <Calculator size={18} className="text-brand-600 dark:text-gold-400" /> Find your fit
      </h2>
      <p className="mb-4 text-sm text-brand-900/50 dark:text-white/50">Tell us your size and we'll recommend the right plan.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Num label="Shops" value={size.shops} onChange={num('shops')} />
        <Num label="Staff" value={size.staff} onChange={num('staff')} />
        <Num label="Products" value={size.products} onChange={num('products')} />
        <Num label="Sales / month" value={size.monthlyTx} onChange={num('monthlyTx')} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-50 p-4 dark:bg-brand-900">
        <Sparkles className="text-gold-500" size={22} />
        <div className="flex-1">
          <div className="text-sm text-brand-900/60 dark:text-white/60">Recommended for you</div>
          <div className="text-lg font-black text-brand-900 dark:text-white">
            {rec.name} · {money(priceFor(rec, cycle))}{cycle === 'annual' ? '/yr' : '/mo'}
          </div>
        </div>
        {rec.id === currentPlan ? (
          <Badge color="green">Your plan</Badge>
        ) : (
          <button className="btn-primary" onClick={() => { onSetPlan(rec.id); onChoose(rec.id) }}>
            Choose {rec.name}
          </button>
        )}
      </div>
    </div>
  )
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input text-center" inputMode="numeric" value={value || ''} onChange={onChange} />
    </div>
  )
}
