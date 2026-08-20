import { useEffect, useCallback, useRef, useState } from 'react'
import { useStore } from '../store/useStore'

const IDLE_WINDOW_MS = 15 * 60 * 1000
const THROTTLE_MS = 60 * 1000

export function useStaffSession(): boolean {
  // Use a local state for the boolean so we only re-render when the session actually expires/activates.
  // We do NOT subscribe to `staffLastActiveAt` to avoid re-rendering the app on every tap.
  const [isValid, setIsValid] = useState(() => {
    const { currentStaffId, staffLastActiveAt } = useStore.getState()
    if (!currentStaffId) return false
    if (!staffLastActiveAt) return false
    if (Date.now() - staffLastActiveAt > IDLE_WINDOW_MS) return false
    return true
  })

  // We subscribe only to currentStaffId changes to handle explicit login/logout
  useEffect(() => {
    const unsub = useStore.subscribe((state, prevState) => {
      if (state.currentStaffId !== prevState.currentStaffId) {
        setIsValid(!!state.currentStaffId)
      }
    })
    return unsub
  }, [])

  const lastWrite = useRef<number>(0)

  // Touch on real user activity
  const touch = useCallback(() => {
    const { currentStaffId, staffLastActiveAt } = useStore.getState()
    if (!currentStaffId) return

    const now = Date.now()
    
    // Check expiry inside touch() FIRST
    if (staffLastActiveAt && now - staffLastActiveAt > IDLE_WINDOW_MS) {
      useStore.setState({ currentStaffId: null, staffLastActiveAt: 0 })
      return
    }

    // Throttle the write to at most once per minute
    if (now - lastWrite.current > THROTTLE_MS) {
      useStore.setState({ staffLastActiveAt: now })
      lastWrite.current = now
    }
  }, [])

  useEffect(() => {
    const events = ['pointerdown', 'keydown', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    return () => events.forEach((e) => window.removeEventListener(e, touch))
  }, [touch])

  // On mount: if idle expired, clear persisted staff
  useEffect(() => {
    const { currentStaffId, staffLastActiveAt } = useStore.getState()
    if (!currentStaffId) return
    if (!staffLastActiveAt || Date.now() - staffLastActiveAt > IDLE_WINDOW_MS) {
      useStore.setState({ currentStaffId: null, staffLastActiveAt: 0 })
    }
  }, []) // mount only

  return isValid
}
