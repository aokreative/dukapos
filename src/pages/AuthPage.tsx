import { useState } from 'react'
import { Store, Loader2, Sparkles, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/cloud'


export default function AuthPage({ unreachable }: { unreachable?: boolean }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    const sb = supabase()
    if (!sb) return

    setLoading(true)
    setError(null)
    setMessage(null)
    
    try {
      if (isSignUp) {
        const { data, error: err } = await sb.auth.signUp({
          email,
          password,
        })
        if (err) throw err
        
        // If Supabase requires email confirmation, it won't return a session immediately.
        if (data.user && !data.session) {
          setMessage('Account created! Please check your email to verify your account.')
          return
        }
      } else {
        const { error: err } = await sb.auth.signInWithPassword({
          email,
          password
        })
        if (err) throw err
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
      setPassword('')
    }
  }

  return (
    <div className="flex min-h-screen bg-brand-900 text-white selection:bg-gold-500/30">
      {/* Left pane - Hero image / brand */}
      <div className="hidden w-1/2 flex-col justify-between bg-black/20 p-12 lg:flex">
        <div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-gold-400">
            <Store size={24} />
          </div>
          <div className="mt-4 text-2xl font-black tracking-tight text-white">
            Duka<span className="text-gold-400">POS</span>
          </div>
        </div>
        
        <div className="max-w-md">
          <h1 className="mb-4 text-4xl font-bold leading-tight">
            The smart way to run your business
          </h1>
          <p className="text-lg text-white/60">
            Join thousands of shops managing sales, inventory, and staff all in one place.
          </p>
          <div className="mt-8 flex items-center gap-4 text-sm font-medium text-gold-400">
            <Sparkles size={18} />
            Multi-Tenant SaaS ready
          </div>
        </div>
      </div>

      {/* Right pane - Auth Form */}
      <div className="flex flex-1 flex-col justify-center px-8 sm:px-16 lg:px-24">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-gold-400">
              <Store size={24} />
            </div>
            <div className="mt-4 text-2xl font-black tracking-tight text-white">
              Duka<span className="text-gold-400">POS</span>
            </div>
          </div>

          <h2 className="text-3xl font-bold tracking-tight">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="mt-2 text-sm text-white/50">
            {isSignUp ? 'Start managing your shop for free today.' : 'Sign in to access your dashboard.'}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-6">
            {unreachable && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm font-medium text-amber-400">
                Couldn’t reach the server — check your connection.
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-medium text-red-400">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm font-medium text-green-400">
                {message}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border-none bg-white/5 px-4 py-3.5 text-white placeholder-white/30 outline-none transition focus:bg-white/10 focus:ring-2 focus:ring-gold-500/50"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-white/70">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border-none bg-white/5 px-4 py-3.5 pr-12 text-white placeholder-white/30 outline-none transition focus:bg-white/10 focus:ring-2 focus:ring-gold-500/50"
                    placeholder="••••••••"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-white/50 hover:text-white/80 transition"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 py-3.5 font-bold text-brand-900 transition hover:bg-gold-400 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Please wait...
                </>
              ) : isSignUp ? (
                'Create account'
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-white/50">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError(null)
                setPassword('')
              }}
              className="font-semibold text-gold-400 hover:underline"
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
