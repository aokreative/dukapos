import { useState } from 'react'
import { Store, Check, UtensilsCrossed, Shirt, Wrench, Plug, Pill, Loader2, Sparkles, Building2 } from 'lucide-react'
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
]

export default function OnboardingPage() {
  const [shopName, setShopName] = useState('')
  const [bizType, setBizType] = useState<BusinessType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!bizType) {
      setError('Please select a business type')
      return
    }
    if (!shopName.trim()) {
      setError('Please enter a shop name')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const client = supabase()
      if (!client) throw new Error('Cloud disconnected')
      const { data: session } = await client.auth.getSession()
      const user = session.session?.user
      if (!user) throw new Error('Not signed in')

      // 1. Create shop in cloud with onboarding_complete = true
      const { error: insertError } = await client
        .from('shops')
        .insert({
          owner_id: user.id,
          name: shopName.trim(),
          business_type: bizType,
          onboarding_complete: true
        })
        .select('id')
        .single()

      if (insertError) throw insertError

      // 2. Update local store
      useStore.getState().updateSettings({
        name: shopName.trim(),
        businessType: bizType,
        etimsEnabled: false
      })
      
      // 3. To transition seamlessly, we just reload so useCloudSync boots up fresh
      window.location.reload()

    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-900 px-6 py-12 text-white">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-600 text-gold-400">
            <Store size={32} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
            Let's set up your shop
          </h1>
          <p className="mt-3 text-white/60">
            We'll customize your dashboard based on how you do business.
          </p>
        </div>

        <form onSubmit={submit} className="rounded-3xl bg-white/5 p-6 shadow-xl backdrop-blur-md md:p-8">
          {error && (
            <div className="mb-6 rounded-xl bg-red-500/10 p-4 text-center text-sm font-medium text-red-400">
              {error}
            </div>
          )}

          <div className="mb-8">
            <label className="mb-2 block text-sm font-semibold text-white/80">Shop Name</label>
            <input
              type="text"
              required
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full rounded-2xl border-none bg-white/5 px-5 py-4 text-lg text-white placeholder-white/30 outline-none transition focus:bg-white/10 focus:ring-2 focus:ring-gold-500/50"
              placeholder="e.g. Duka Yetu"
            />
          </div>

          <div className="mb-8">
            <label className="mb-4 block text-sm font-semibold text-white/80">Business Type</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {BIZ_TYPES.map((b) => {
                const Icon = b.icon
                const active = bizType === b.id
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBizType(b.id)}
                    className={`group relative flex flex-col items-center rounded-2xl border p-4 text-center transition ${
                      active
                        ? 'border-gold-500 bg-gold-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    {active && (
                      <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gold-500 text-brand-900 shadow-sm">
                        <Check size={14} strokeWidth={3} />
                      </div>
                    )}
                    <Icon size={28} className={`mb-3 ${active ? 'text-gold-400' : 'text-white/40 group-hover:text-white/70'}`} />
                    <div className={`text-sm font-bold ${active ? 'text-white' : 'text-white/70'}`}>
                      {b.name}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-500 py-4 text-lg font-bold text-brand-900 transition hover:bg-gold-400 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Setting up...
              </>
            ) : (
              'Complete Setup'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
