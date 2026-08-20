// Runs the automated reminder engine while the app is open and online.
// Automated sends go through the backend relay (or simulation) — they never
// open a WhatsApp/SMS tab, so they are truly hands-off.
import { useEffect } from 'react'

import { useOnline } from './useOnline'

const TICK_MS = 60_000 // check once a minute while open

export function useAutomation() {
  const online = useOnline()
  
  useEffect(() => {
    
    async function tick() {
      // Automation is disabled because the backend server is retired.
      return
    }

    // Kick off shortly after load, then on an interval.
    const first = setTimeout(tick, 2500)
    const id = setInterval(tick, TICK_MS)
    return () => {
            clearTimeout(first)
      clearInterval(id)
    }
  }, [online])
}
