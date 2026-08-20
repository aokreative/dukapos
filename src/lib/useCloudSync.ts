import { useEffect, useRef, useState } from 'react'
import { supabase, cloudConfigured } from './cloud'
import { useStore } from '../store/useStore'

export function useCloudSync() {
  const processing = useRef(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const shopIdRef = useRef<string | null>(null)
  const startRef = useRef(false)

  useEffect(() => {
    const client = supabase()
    if (!client) {
      useStore.setState({ _cloudSession: 'off' })
      return
    }
    const sb = client
    let unsubStore: (() => void) | null = null
    let activeTimeout: any = null

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

    async function fetchInitialData() {
      if (!shopIdRef.current) return
      const { data: products } = await sb.from('products').select('*').eq('shop_id', shopIdRef.current)
      if (products && products.length > 0) {
         // Future improvement: Merge cloud products into local store
      }
    }

    async function start(userId: string, userEmail: string | null) {
      if (startRef.current) return
      startRef.current = true

      if (timer.current) clearInterval(timer.current)
      
      useStore.setState({ _cloudEmail: userEmail })

      if (userEmail === 'aokreative@gmail.com') {
        useStore.setState({ _cloudSession: 'signedIn', _cloudRole: 'superadmin' })
        return
      }

      useStore.setState({ _cloudSession: 'signedIn', _cloudRole: 'tenant' })
      
      const { data: shops, error } = await sb.from('shops').select('id, name, business_type, onboarding_complete').eq('owner_id', userId)
      if (error) {
        console.error('Error fetching shop:', error)
        useStore.setState({ _cloudSession: 'error' })
        return
      }

      const shop = shops?.[0]
      if (!shop || !shop.onboarding_complete) {
        useStore.setState({ _cloudOnboarding: 'pending' })
        return
      }
      
      useStore.setState({ _cloudOnboarding: 'complete' })
      shopIdRef.current = shop.id

      useStore.getState().updateSettings({
        name: shop.name,
        ...(shop.business_type ? { businessType: shop.business_type as any } : {})
      })

      await fetchInitialData()

      processQueue()
      timer.current = setInterval(processQueue, 3000)

      unsubStore = useStore.subscribe((state, prevState) => {
         if (state.syncQueue.length > prevState.syncQueue.length) {
            processQueue()
         }
      })
    }

    function stop() {
      startRef.current = false
      if (timer.current) clearInterval(timer.current)
      timer.current = null
      unsubStore?.()
      unsubStore = null
      shopIdRef.current = null
      useStore.setState({
        _cloudSession: 'signedOut',
        _cloudRole: null,
        _cloudEmail: null,
        _cloudOnboarding: null,
      })
    }

    activeTimeout = setTimeout(() => {
      if (useStore.getState()._cloudSession === 'initializing') {
        useStore.setState({ _cloudSession: 'signedOut' })
      }
    }, 5000)

    sb.auth.getSession().then(({ data }) => {
      if (activeTimeout) clearTimeout(activeTimeout)
      const u = data.session?.user
      if (u) start(u.id, u.email ?? null)
      else useStore.setState({ _cloudSession: 'signedOut' })
    }).catch(() => {
      if (activeTimeout) clearTimeout(activeTimeout)
      useStore.setState({ _cloudSession: 'signedOut' })
    })

    const { data: authSub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) start(session.user.id, session.user.email ?? null)
      if (event === 'SIGNED_OUT') stop()
    })

    return () => {
      if (activeTimeout) clearTimeout(activeTimeout)
      authSub.subscription.unsubscribe()
      stop()
    }
  }, [])
}

