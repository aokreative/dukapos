import { useState } from 'react'
import {
  Store,
  Check,
  UtensilsCrossed,
  Shirt,
  Wrench,
  Plug,
  Pill,
  Loader2,
  Sparkles,
  Building2,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react'
import { supabase } from '../lib/cloud'
import { useStore } from '../store/useStore'
import type { BusinessType } from '../types'

const BIZ_TYPES: { id: BusinessType; name: string; icon: any; desc: string }[] = [
  { id: 'shop', name: 'Duka / Mini Mart', icon: Store, desc: 'General retail & groceries' },
  { id: 'wholesale', name: 'Wholesale', icon: Building2, desc: 'Bulk goods & distribution' },
  { id: 'restaurant', name: 'Restaurant / Cafe', icon: UtensilsCrossed, desc: 'Food & drinks' },
  { id: 'boutique', name: 'Boutique', icon: Shirt, desc: 'Clothes & shoes' },
  { id: 'hardware', name: 'Hardware', icon: Wrench, desc: 'Construction & tools' },
  { id: 'electronics', name: 'Electronics', icon: Plug, desc: 'Phones, CCTV, accessories' },
  { id: 'pharmacy', name: 'Pharmacy', icon: Pill, desc: 'Chemist & meds' },
  { id: 'agrovet', name: 'Agrovet', icon: Sparkles, desc: 'Farming & vet supplies' },
  { id: 'babyshop', name: 'Baby Shop', icon: Store, desc: 'Kids & baby items' },
  { id: 'autospares', name: 'Auto Spares', icon: Wrench, desc: 'Vehicle parts & spares' },
  { id: 'spices', name: 'Spices & Cereals', icon: Store, desc: 'Herbs, spices, grains' },
]

type Step = 'shop' | 'type' | 'pin'

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('shop')
  const [shopName, setShopName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [bizType, setBizType] = useState<BusinessType | null>(null)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function finish() {
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return }
    if (pin !== confirmPin) { setError('PINs do not match'); return }

    setLoading(true)
    setError(null)

    try {
      // 1. Save settings locally
      useStore.getState().updateSettings({
        name: shopName.trim(),
        businessType: bizType!,
        cashierName: ownerName.trim() || 'Owner',
      })

      // 2. Create the first owner account in the local staff store
      const addStaff = useStore.getState().addStaff
      addStaff({
        name: ownerName.trim() || 'Owner',
        role: 'owner',
        pin,
        active: true,
      })

      // 3. If connected to Supabase, also persist the shop there
      const client = supabase?.()
      if (client) {
        const { data: session } = await client.auth.getSession()
        const user = session.session?.user
        if (user) {
          await client
            .from('shops')
            .insert({
              owner_id: user.id,
              name: shopName.trim(),
              business_type: bizType,
              onboarding_complete: true,
            })
            .select('id')
            .single()
        }
      }

      // 4. Reload so the store re-hydrates and routing picks up the new staff
      window.location.reload()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-900 px-6 py-12 text-white">
      {/* Progress bar */}
      <div className="mb-10 flex w-full max-w-md items-center gap-2">
        {(['shop', 'type', 'pin'] as Step[]).map((s, i) => (
          <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all duration-300
              ${step === s ? 'bg-gold-500 text-brand-900 shadow-lg shadow-gold-500/30' :
                ['shop', 'type', 'pin'].indexOf(step) > i ? 'bg-brand-600 text-white' : 'bg-white/10 text-white/40'}`}>
              {['shop', 'type', 'pin'].indexOf(step) > i ? <Check size={14} /> : i + 1}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${step === s ? 'text-gold-400' : 'text-white/30'}`}>
              {s === 'shop' ? 'Shop Info' : s === 'type' ? 'Biz Type' : 'Owner PIN'}
            </span>
          </div>
        ))}
      </div>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500/10 ring-1 ring-gold-500/30">
            {step === 'shop' && <Store size={26} className="text-gold-400" />}
            {step === 'type' && <Building2 size={26} className="text-gold-400" />}
            {step === 'pin' && <Lock size={26} className="text-gold-400" />}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            {step === 'shop' && "Let's set up your shop"}
            {step === 'type' && 'What kind of business?'}
            {step === 'pin' && 'Create your owner PIN'}
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {step === 'shop' && 'This is what customers and staff will see.'}
            {step === 'type' && 'We\'ll tailor the POS features for your business.'}
            {step === 'pin' && 'This PIN secures the owner account. Keep it private.'}
          </p>
        </div>

        <div className="rounded-3xl bg-white/5 p-6 shadow-2xl backdrop-blur-md ring-1 ring-white/10 md:p-8">
          {error && (
            <div className="mb-5 rounded-xl bg-red-500/15 p-3 text-center text-sm font-semibold text-red-400 ring-1 ring-red-500/20">
              {error}
            </div>
          )}

          {/* ── Step 1: Shop Info ────────────────────────────────── */}
          {step === 'shop' && (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/60">Shop Name</label>
                <input
                  type="text"
                  autoFocus
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && shopName.trim() && setStep('type')}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-lg text-white placeholder-white/25 outline-none transition focus:border-gold-500/50 focus:bg-white/10 focus:ring-2 focus:ring-gold-500/20"
                  placeholder="e.g. Mama Njeri Supermarket"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/60">Your Name (Owner)</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && shopName.trim() && setStep('type')}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-lg text-white placeholder-white/25 outline-none transition focus:border-gold-500/50 focus:bg-white/10 focus:ring-2 focus:ring-gold-500/20"
                  placeholder="e.g. Jane Wambui"
                />
              </div>
              <button
                disabled={!shopName.trim()}
                onClick={() => { if (shopName.trim()) { setError(null); setStep('type') } }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-500 py-4 text-base font-bold text-brand-900 transition hover:bg-gold-400 active:scale-[0.98] disabled:opacity-40"
              >
                Continue <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* ── Step 2: Business Type ────────────────────────────── */}
          {step === 'type' && (
            <div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {BIZ_TYPES.map((b) => {
                  const Icon = b.icon
                  const active = bizType === b.id
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBizType(b.id)}
                      className={`group relative flex flex-col items-center rounded-2xl border p-3 text-center transition ${
                        active
                          ? 'border-gold-500 bg-gold-500/10 shadow-md shadow-gold-500/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      {active && (
                        <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gold-500 text-brand-900 shadow-sm">
                          <Check size={11} strokeWidth={3} />
                        </div>
                      )}
                      <Icon size={22} className={`mb-2 ${active ? 'text-gold-400' : 'text-white/40 group-hover:text-white/70'}`} />
                      <div className={`text-xs font-bold leading-tight ${active ? 'text-white' : 'text-white/60'}`}>{b.name}</div>
                    </button>
                  )
                })}
              </div>
              <button
                disabled={!bizType}
                onClick={() => { if (bizType) { setError(null); setStep('pin') } }}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-500 py-4 text-base font-bold text-brand-900 transition hover:bg-gold-400 active:scale-[0.98] disabled:opacity-40"
              >
                Continue <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* ── Step 3: Owner PIN ────────────────────────────────── */}
          {step === 'pin' && (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/60">Create PIN (4–6 digits)</label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    value={pin}
                    onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(null) }}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 pr-14 text-2xl tracking-[0.4em] text-white placeholder-white/20 outline-none transition focus:border-gold-500/50 focus:bg-white/10 focus:ring-2 focus:ring-gold-500/20"
                    placeholder="••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition"
                  >
                    {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/60">Confirm PIN</label>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, '')); setError(null) }}
                  onKeyDown={(e) => e.key === 'Enter' && pin.length >= 4 && finish()}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-2xl tracking-[0.4em] text-white placeholder-white/20 outline-none transition focus:border-gold-500/50 focus:bg-white/10 focus:ring-2 focus:ring-gold-500/20"
                  placeholder="••••"
                />
              </div>
              <button
                disabled={loading || pin.length < 4}
                onClick={finish}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-500 py-4 text-base font-bold text-brand-900 transition hover:bg-gold-400 active:scale-[0.98] disabled:opacity-40"
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> Setting up…</> : <><ShieldCheck size={18} /> Launch My Shop</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
