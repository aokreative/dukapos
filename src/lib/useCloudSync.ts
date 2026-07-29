import { useEffect, useRef, useState } from 'react'
import { supabase, cloudConfigured } from './cloud'
import { useStore } from '../store/useStore'
import { SyncQueueItem } from '../types'

export type CloudStatus = 'off' | 'signedOut' | 'syncing' | 'live' | 'error'

export function useCloudSync() {
  const [status, setStatus] = useState<CloudStatus>(cloudConfigured ? 'signedOut' : 'off')
  const [email, setEmail] = useState<string | null>(null)
  const processing = useRef(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const shopIdRef = useRef<string | null>(null)

  useEffect(() => {
    const client = supabase()
    if (!client) return
    const sb = client

    let unsubStore: (() => void) | null = null

    async function processQueue() {
      if (processing.current) return
      const s = useStore.getState()
      const queue = s.syncQueue
      if (!queue.length) return
      if (!shopIdRef.current) return

      processing.current = true
      setStatus('syncing')
      
      const successIds: string[] = []
      
      for (const item of queue) {
        try {
          const { table, action, record } = item.op
          // Add shop_id to the record for multi-tenant tables
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
            // If it's a unique constraint error (e.g. already inserted), we might want to pop it anyway,
            // but for now let's halt the queue so we don't drop data.
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
      
      setStatus('live')
      processing.current = false
    }

    async function fetchInitialData() {
      if (!shopIdRef.current) return
      // Example: fetch products to get authoritative stock
      const { data: products } = await sb.from('products').select('*').eq('shop_id', shopIdRef.current)
      if (products && products.length > 0) {
         // Merge into local store
         // (Omitted for brevity in this initial implementation, but this is where
         // we would map db products back to local Zustand products).
      }
    }

    async function start(userId: string, userEmail: string | null) {
      setStatus('syncing')
      setEmail(userEmail)
      
      // 1. Ensure shop exists
      const { data: shops } = await sb.from('shops').select('id').eq('owner_id', userId)
      let sId = shops?.[0]?.id
      if (!sId) {
        const { data: newShop, error } = await sb.from('shops').insert({ owner_id: userId, name: useStore.getState().settings.name }).select('id').single()
        if (error) {
           console.error(error)
           setStatus('error')
           return
        }
        sId = newShop?.id
      }
      shopIdRef.current = sId

      // 2. Fetch authoritative data
      await fetchInitialData()

      // 3. Start processing queue
      processQueue()
      
      // Check queue every 3 seconds
      if (timer.current) clearInterval(timer.current)
      timer.current = setInterval(processQueue, 3000)

      // Also trigger process immediately on store change if there's something new
      unsubStore = useStore.subscribe((state, prevState) => {
         if (state.syncQueue.length > prevState.syncQueue.length) {
            processQueue()
         }
      })
    }

    function stop() {
      if (timer.current) clearInterval(timer.current)
      timer.current = null
      unsubStore?.()
      unsubStore = null
      setEmail(null)
      shopIdRef.current = null
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
