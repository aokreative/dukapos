import { useState, useEffect } from 'react'
import {
  Store, Check, UtensilsCrossed, Shirt, Wrench, Plug, Pill,
  Loader2, Sparkles, Building2, Eye, EyeOff, Lock, ShieldCheck,
  ChevronRight, ChevronLeft, LogOut
} from 'lucide-react'
import { supabase } from '../lib/cloud'
import { useStore } from '../store/useStore'
import { resetAuth } from '../App'
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

export default function OnboardingPage() {
  const draftShopName = useStore(s => s._draftShopName)
  const draftOwnerName = useStore(s => s._draftOwnerName)
  const draftBizType = useStore(s => s._draftBizType as BusinessType | null)
  const setDraft = useStore(s => s.setDraftOnboarding)
  const clearDraft = useStore(s => s.clearDraftOnboarding)
  const cloudEmail = useStore(s => s._cloudEmail)

  const [step, setStep] = useState(0)
  
  // Local volatile state
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync back button
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (step > 0) {
        e.preventDefault()
        setStep(s => s - 1)
        window.history.pushState(null, '') // prevent actual navigation
      }
    }
    window.history.pushState(null, '')
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [step])

  const goBack = () => {
    if (step > 0) setStep(s => s - 1)
  }

  const goNext = () => {
    if (step === 0) {
      if (!draftShopName.trim()) return
      setStep(1)
    } else if (step === 1) {
      if (!draftBizType) return
      setStep(2)
    }
  }

  async function handleSignOut() {
    const sb = supabase()
    if (sb) await sb.auth.signOut()
    resetAuth()
  }

  async function finish() {
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return }
    if (pin !== confirmPin) { setError('PINs do not match'); return }

    setLoading(true)
    setError(null)

    try {
      useStore.getState().updateSettings({
        name: draftShopName.trim(),
        businessType: draftBizType!,
        cashierName: draftOwnerName.trim() || 'Owner',
      })

      const ownerId = 'staff_' + Math.random().toString(36).substring(2, 11)
      useStore.setState((s) => ({
        staff: [...s.staff, { 
          id: ownerId, 
          name: draftOwnerName.trim() || 'Owner', 
          role: 'owner', 
          pin, 
          active: true, 
          createdAt: Date.now() 
        }],
        currentStaffId: ownerId
      }))
      const client = supabase?.()
      if (client) {
        const { data: session } = await client.auth.getSession()
        const user = session.session?.user
        if (user) {
          // Idempotent insert with upsert
          const { error: upsertErr } = await client
            .from('shops')
            .upsert({
              owner_id: user.id,
              name: draftShopName.trim(),
              business_type: draftBizType,
              onboarding_complete: true,
            }, { onConflict: 'owner_id' })
            
          if (upsertErr) throw upsertErr
        }
      }

      clearDraft()
      window.location.reload()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleBizTypeSelect = (id: BusinessType) => {
    if (draftBizType && draftBizType !== id && step > 1) {
      if (!window.confirm("Changing your business type will reset some specific setups. Continue?")) {
        return
      }
    }
    setDraft({ _draftBizType: id })
  }

  // Fallback for step out of bounds
  const currentStep = step < 0 || step > 2 ? 0 : step

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-900 px-6 py-12 text-white">
      {/* Top Nav (Back / Sign Out) */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
        {currentStep > 0 ? (
          <button onClick={goBack} className="flex items-center gap-1.5 text-sm font-bold text-white/50 hover:text-white/80 transition">
            <ChevronLeft size={16} /> Back
          </button>
        ) : (
          <div /> // spacer
        )}
        
        {cloudEmail && currentStep === 0 && (
          <button onClick={handleSignOut} className="flex items-center gap-1.5 text-xs font-bold text-white/40 hover:text-red-400 transition bg-white/5 px-3 py-1.5 rounded-full">
            <LogOut size={12} /> Use different email
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-10 flex w-full max-w-md items-center gap-2">
        {[0, 1, 2].map((s) => (
          <button 
            key={s} 
            disabled={s > currentStep}
            onClick={() => { if (s < currentStep) setStep(s) }}
            className={`flex flex-1 flex-col items-center gap-1.5 ${s < currentStep ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all duration-300
              ${currentStep === s ? 'bg-gold-500 text-brand-900 shadow-lg shadow-gold-500/30' :
                currentStep > s ? 'bg-brand-600 text-white' : 'bg-white/10 text-white/40'}`}>
              {currentStep > s ? <Check size={14} /> : s + 1}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${currentStep === s ? 'text-gold-400' : 'text-white/30'}`}>
              {s === 0 ? 'Shop Info' : s === 1 ? 'Biz Type' : 'Owner PIN'}
            </span>
          </button>
        ))}
      </div>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500/10 ring-1 ring-gold-500/30">
            {currentStep === 0 && <Store size={26} className="text-gold-400" />}
            {currentStep === 1 && <Building2 size={26} className="text-gold-400" />}
            {currentStep === 2 && <Lock size={26} className="text-gold-400" />}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            {currentStep === 0 && "Let's set up your shop"}
            {currentStep === 1 && 'What kind of business?'}
            {currentStep === 2 && 'Create your owner PIN'}
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {currentStep === 0 && (cloudEmail ? `Signed in as ${cloudEmail}` : 'This is what customers and staff will see.')}
            {currentStep === 1 && 'We\'ll tailor the POS features for your business.'}
            {currentStep === 2 && 'This PIN secures the owner account. Keep it private.'}
          </p>
        </div>

        <div className="rounded-3xl bg-white/5 p-6 shadow-2xl backdrop-blur-md ring-1 ring-white/10 md:p-8">
          {error && (
            <div className="mb-5 rounded-xl bg-red-500/15 p-3 text-center text-sm font-semibold text-red-400 ring-1 ring-red-500/20">
              {error}
            </div>
          )}

          {currentStep === 0 && (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/60">Shop Name</label>
                <input
                  type="text"
                  autoFocus
                  value={draftShopName}
                  onChange={(e) => setDraft({ _draftShopName: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && draftShopName.trim() && goNext()}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-lg text-white placeholder-white/25 outline-none transition focus:border-gold-500/50 focus:bg-white/10 focus:ring-2 focus:ring-gold-500/20"
                  placeholder="e.g. Mama Njeri Supermarket"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/60">Your Name (Owner)</label>
                <input
                  type="text"
                  value={draftOwnerName}
                  onChange={(e) => setDraft({ _draftOwnerName: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && draftShopName.trim() && goNext()}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-lg text-white placeholder-white/25 outline-none transition focus:border-gold-500/50 focus:bg-white/10 focus:ring-2 focus:ring-gold-500/20"
                  placeholder="e.g. Jane Wambui"
                />
              </div>
              <button
                disabled={!draftShopName.trim()}
                onClick={() => { setError(null); goNext() }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-500 py-4 text-base font-bold text-brand-900 transition hover:bg-gold-400 active:scale-[0.98] disabled:opacity-40"
              >
                Continue <ChevronRight size={18} />
              </button>
            </div>
          )}

          {currentStep === 1 && (
            <div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {BIZ_TYPES.map((b) => {
                  const Icon = b.icon
                  const active = draftBizType === b.id
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleBizTypeSelect(b.id)}
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
                disabled={!draftBizType}
                onClick={() => { setError(null); goNext() }}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-500 py-4 text-base font-bold text-brand-900 transition hover:bg-gold-400 active:scale-[0.98] disabled:opacity-40"
              >
                Continue <ChevronRight size={18} />
              </button>
            </div>
          )}

          {currentStep === 2 && (
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
