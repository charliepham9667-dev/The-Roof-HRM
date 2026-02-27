import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div
      className={cn(
        'fixed left-0 right-0 top-0 z-50',
        'bg-amber-500/95 text-amber-950',
        'px-4 py-2 text-center text-sm font-medium',
        'pt-[max(0.5rem,env(safe-area-inset-top))]'
      )}
    >
      You're offline. Some features require a connection.
    </div>
  )
}
