import { useEffect, useRef } from 'react'

export function useIdleTimer(timeoutMinutes: number, onIdle: () => void) {
  const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleActivity = () => {
      if (timeoutId.current) clearTimeout(timeoutId.current)
      timeoutId.current = setTimeout(() => {
        onIdle()
      }, timeoutMinutes * 60 * 1000)
    }

    // Set initial timeout
    handleActivity()

    // Add event listeners
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach((event) => window.addEventListener(event, handleActivity))

    return () => {
      if (timeoutId.current) clearTimeout(timeoutId.current)
      events.forEach((event) => window.removeEventListener(event, handleActivity))
    }
  }, [timeoutMinutes, onIdle])
}
