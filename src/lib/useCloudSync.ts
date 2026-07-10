// Live multi-device sync. While a shop is signed in (Settings → Cloud sync),
// this hook keeps local state and the cloud row in step:
//   local change → debounced push (version+1)
//   remote change (another device) → merge into local
import { useEffect, useRef, useState } from 'react'
import { supabase, cloudConfigured, mergeState, normalizeSynced, type SyncedState } from './cloud'
import { useStore } from '../store/useStore'

export type CloudStatus = 'off' | 'signedOut' | 'syncing' | 'live' | 'error'

function pickSlice(): SyncedState {
  const s = useStore.getState()
  return {
    products: s.products,
    customers: s.customers,
    sales: s.sales,
    debts: s.debts,
    staff: s.staff,
    reminderLog: s.reminderLog,
    receiptCounter: s.receiptCounter,
    locations: s.locations,
    transfers: s.transfers,
    returns: s.returns,
    suppliers: s.suppliers,
    supplierTxns: s.supplierTxns,
    expenses: s.expenses,
    shifts: s.shifts,
    settings: s.settings,
  }
}

export function useCloudSync() {
  const [status, setStatus] = useState<CloudStatus>(cloudConfigured ? 'signedOut' : 'off')
  const [email, setEmail] = useState<string | null>(null)
  const version = useRef(0)
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const applying = useRef(false)

  useEffect(() => {
    const client = supabase()
    if (!client) return
    const sb = client

    let channel: ReturnType<typeof sb.channel> | null = null
    let unsubStore: (() => void) | null = null

    async function push(userId: string) {
      const sb2 = supabase()
      if (!sb2) return
      version.current += 1
      const state = pickSlice()
      const { error } = await sb2.from('shop_state').upsert({
        id: userId,
        business: useStore.getState().settings.name,
        state,
        version: version.current,
        updated_at: new Date().toISOString(),
      })
      setStatus(error ? 'error' : 'live')
    }

    function schedulePush(userId: string) {
      if (applying.current) return // don't echo remote-applied changes
      if (pushTimer.current) clearTimeout(pushTimer.current)
      pushTimer.current = setTimeout(() => push(userId), 1200)
    }

    function applyRemote(remote: SyncedState, remoteVersion: number, remoteIsNewer: boolean) {
      applying.current = true
      try {
        const merged = mergeState(pickSlice(), normalizeSynced(remote), remoteIsNewer)
        // Never let an empty cloud locations list wipe this device's branches.
        if (!merged.locations.length) merged.locations = useStore.getState().locations
        // Never blank out shop settings from a row that didn't carry them.
        if (!merged.settings) merged.settings = useStore.getState().settings
        version.current = Math.max(version.current, remoteVersion)
        useStore.setState(merged)
      } finally {
        setTimeout(() => (applying.current = false), 100)
      }
    }

    async function start(userId: string, userEmail: string | null) {
      setStatus('syncing')
      setEmail(userEmail)
      // Initial pull + merge + push.
      const { data } = await sb.from('shop_state').select('state, version').eq('id', userId).maybeSingle()
      if (data?.state && Object.keys(data.state).length) {
        applyRemote(data.state as SyncedState, Number(data.version) || 0, true)
      }
      await push(userId)
      // Realtime: changes from other devices.
      channel = sb
        .channel('shop_state_' + userId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_state', filter: `id=eq.${userId}` }, (payload) => {
          const row = payload.new as { state?: SyncedState; version?: number }
          const v = Number(row?.version) || 0
          if (row?.state && v > version.current) applyRemote(row.state, v, true)
        })
        .subscribe()
      // Local changes → debounced push.
      unsubStore = useStore.subscribe(() => schedulePush(userId))
    }

    function stop() {
      if (channel) sb.removeChannel(channel)
      channel = null
      unsubStore?.()
      unsubStore = null
      setEmail(null)
      setStatus('signedOut')
    }

    sb.auth.getSession().then(({ data }) => {
      const u = data.session?.user
      if (u) start(u.id, u.email ?? null)
    })
    const { data: authSub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) start(session.user.id, session.user.email ?? null)
      if (event === 'SIGNED_OUT') stop()
    })

    return () => {
      authSub.subscription.unsubscribe()
      stop()
    }
  }, [])

  return { status, email }
}
