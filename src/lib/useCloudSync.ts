import { useEffect, useRef } from 'react'
import { supabase } from './cloud'
import { useStore } from '../store/useStore'

// Terminal session states — once here, the boot flow is finished.
const TERMINAL = new Set(['signedIn', 'signedOut', 'off', 'error'])

export function useCloudSync() {
  const hydrated = useStore(s => s._hasHydrated)
  const processing = useRef(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const shopIdRef = useRef<string | null>(null)
  const startRef = useRef(false)

  useEffect(() => {
    if (!hydrated) return
    const client = supabase()
    if (!client) {
      useStore.setState({ _cloudSession: 'off' })
      return
    }
    const sb = client
    let unsubStore: (() => void) | null = null
    let deadlineTimer: ReturnType<typeof setTimeout> | null = null

    // ------------------------------------------------------------------
    // Helper: mark a terminal state and clear the deadline.
    // ------------------------------------------------------------------
    function terminal(
      state: 'signedIn' | 'signedOut' | 'off' | 'error',
      extra?: Record<string, unknown>,
    ) {
      if (deadlineTimer) {
        clearTimeout(deadlineTimer)
        deadlineTimer = null
      }
      useStore.setState({ _cloudSession: state, ...extra } as any)
    }

    // ------------------------------------------------------------------
    // processQueue — unchanged
    // ------------------------------------------------------------------
    async function processQueue() {
      if (processing.current) return
      const s = useStore.getState()
      const queue = s.syncQueue
      if (!queue.length) return
      if (!shopIdRef.current) return

      processing.current = true
      
      const successIds: string[] = []
      
      for (const item of queue) {
        try {
          const { table, action, record } = item.op
          const payload = { ...record }
          if (table !== 'shops' && table !== 'profiles') {
             payload.shop_id = shopIdRef.current
          }

          let err = null
          if (action === 'insert') {
            const { error } = await sb.from(table).insert(payload)
            err = error
          } else if (action === 'update') {
            const { error } = await sb.from(table).update(payload).eq('id', record.id)
            err = error
          } else if (action === 'delete') {
            const { error } = await sb.from(table).delete().eq('id', record.id)
            err = error
          }

          if (err) {
            console.error('Sync error:', err)
            break 
          }
          successIds.push(item.id)
        } catch (e) {
          console.error(e)
          break
        }
      }

      if (successIds.length > 0) {
        useStore.getState().dequeueSyncItems(successIds)
      }
      
      processing.current = false
    }

    // ------------------------------------------------------------------
    // fetchInitialData — unchanged
    // ------------------------------------------------------------------
    async function fetchInitialData() {
      if (!shopIdRef.current) return
      const { data: products } = await sb.from('products').select('*').eq('shop_id', shopIdRef.current)
      if (products && products.length > 0) {
         // Future improvement: Merge cloud products into local store
      }
    }

    // ------------------------------------------------------------------
    // start — FIX #2: set signedIn BEFORE the shops query.
    // The user is authenticated the moment getSession returns them;
    // the shop lookup only decides onboarding state.
    // ------------------------------------------------------------------
    async function start(userId: string, userEmail: string | null) {
      if (startRef.current) return
      startRef.current = true

      if (timer.current) clearInterval(timer.current)
      
      useStore.setState({ _cloudEmail: userEmail })

      if (userEmail === 'aokreative@gmail.com') {
        terminal('signedIn', { _cloudRole: 'superadmin' })
        return
      }

      // FIX #2 — mark signedIn immediately; shops query decides onboarding,
      // not whether the user is authenticated.
      terminal('signedIn', { _cloudRole: 'tenant' })
      
      try {
        const { data: shops, error } = await sb.from('shops').select('id, name, business_type, onboarding_complete').eq('owner_id', userId)
        if (error) {
          console.error('Error fetching shop:', error)
          // Session stays signedIn — user is authenticated. Only onboarding fails.
          useStore.setState({ _cloudOnboarding: 'pending' })
          return
        }

        const shop = shops?.[0]
        if (!shop || !shop.onboarding_complete) {
          useStore.setState({ _cloudOnboarding: 'pending', tenantId: shop?.id })
          return
        }
        
        useStore.setState({ _cloudOnboarding: 'complete', tenantId: shop.id })
        shopIdRef.current = shop.id

        useStore.getState().updateSettings({
          name: shop.name,
          ...(shop.business_type ? { businessType: shop.business_type as any } : {})
        })

        await fetchInitialData()

        // — existing processQueue / interval / store-subscription code —
        processQueue()
        timer.current = setInterval(processQueue, 3000)

        unsubStore = useStore.subscribe((state, prevState) => {
           if (state.syncQueue.length > prevState.syncQueue.length) {
              processQueue()
           }
        })
      } catch (e) {
        console.error('Shop lookup failed:', e)
        // Session stays signedIn — onboarding falls back to pending
        useStore.setState({ _cloudOnboarding: 'pending' })
      }
    }

    // ------------------------------------------------------------------
    // stop — unchanged, plus clears _cloudUnreachable and deadline
    // ------------------------------------------------------------------
    function stop() {
      startRef.current = false
      if (timer.current) clearInterval(timer.current)
      timer.current = null
      if (deadlineTimer) {
        clearTimeout(deadlineTimer)
        deadlineTimer = null
      }
      unsubStore?.()
      unsubStore = null
      shopIdRef.current = null
      useStore.setState({
        _cloudSession: 'signedOut',
        _cloudRole: null,
        _cloudEmail: null,
        _cloudOnboarding: null,
        _cloudUnreachable: false,
      })
    }

    // ==================================================================
    // FIX #1 — Unconditional 5 s deadline.
    // Registered BEFORE the getSession call. Not inside any .then().
    // Cleared ONLY when a terminal state is reached (via `terminal()`).
    // If the session isn't terminal when it fires, forces signedOut.
    // ==================================================================
    deadlineTimer = setTimeout(() => {
      const cur = useStore.getState()._cloudSession
      if (!TERMINAL.has(cur)) {
        console.warn('Cloud session deadline: still "%s" after 5 s — forcing signedOut', cur)
        useStore.setState({ _cloudSession: 'signedOut', _cloudUnreachable: true })
        deadlineTimer = null
      }
    }, 5000)

    // ==================================================================
    // FIX #3 — Race getSession against a 4 s timeout.
    // getSession() usually reads local storage instantly, but on mobile
    // it can hang if browser storage access is restricted.
    // ==================================================================
    const getSessionWithTimeout = Promise.race([
      sb.auth.getSession(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('getSession timed out (4 s)')), 4000),
      ),
    ])

    getSessionWithTimeout.then(({ data }) => {
      const u = data.session?.user
      if (u) {
        start(u.id, u.email ?? null)
      } else {
        terminal('signedOut')
      }
    }).catch((err) => {
      console.warn('getSession failed or timed out:', err)
      // Don't clear the deadline here — let it fire and set _cloudUnreachable.
      // But if we can already tell there's no session, go terminal now.
      const cur = useStore.getState()._cloudSession
      if (!TERMINAL.has(cur)) {
        terminal('signedOut', { _cloudUnreachable: true })
      }
    })

    // ==================================================================
    // FIX #4 — Handle INITIAL_SESSION explicitly.
    // This fires when there's no stored session to restore.
    // ==================================================================
    const { data: authSub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        start(session.user.id, session.user.email ?? null)
      } else if (event === 'SIGNED_OUT') {
        stop()
      } else if (event === 'INITIAL_SESSION' && !session) {
        // No stored session — user needs to sign in.
        terminal('signedOut')
      }
    })

    return () => {
      if (deadlineTimer) {
        clearTimeout(deadlineTimer)
        deadlineTimer = null
      }
      authSub.subscription.unsubscribe()
      stop()
    }
  }, [hydrated])
}
