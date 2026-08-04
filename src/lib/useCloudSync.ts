import { useEffect, useRef, useState } from 'react'
import { supabase, cloudConfigured } from './cloud'
import { useStore } from '../store/useStore'

export type CloudStatus = 'off' | 'initializing' | 'signedOut' | 'onboarding' | 'syncing' | 'live' | 'error'

export function useCloudSync() {
  const [status, setStatus] = useState<CloudStatus>(cloudConfigured ? 'initializing' : 'off')
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
      
      setStatus('live')
      processing.current = false
    }

    async function fetchInitialData() {
      if (!shopIdRef.current) return
      const { data: products } = await sb.from('products').select('*').eq('shop_id', shopIdRef.current)
      if (products && products.length > 0) {
         // Future improvement: Merge cloud products into local store
      }
    }

    async function start(userId: string, userEmail: string | null) {
      setStatus('syncing')
      setEmail(userEmail)
      
      // 1. Fetch shop and onboarding status
      const { data: shops, error } = await sb.from('businesses').select('id, name, business_type, onboarding_complete').eq('owner_id', userId)
      if (error) {
        console.error('Error fetching business:', error)
        setStatus('error')
        return
      }

      const shop = shops?.[0]
      if (!shop || !shop.onboarding_complete) {
        setStatus('onboarding')
        return
      }
      
      shopIdRef.current = shop.id

      // 2. Sync cloud profile down to local store
      useStore.getState().updateSettings({
        name: shop.name,
        ...(shop.business_type ? { businessType: shop.business_type as any } : {})
      })

      // 3. Fetch authoritative data
      await fetchInitialData()

      // 4. Start processing queue
      processQueue()
      
      if (timer.current) clearInterval(timer.current)
      timer.current = setInterval(processQueue, 3000)

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
      if (u) {
        start(u.id, u.email ?? null)
      } else {
        setStatus('signedOut')
      }
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
