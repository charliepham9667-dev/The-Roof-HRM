import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Initialize synchronously from matchMedia so phones don't get a flash of
 * desktop layout before the effect runs. Falls back to `false` only when
 * `window` is unavailable (SSR / unit tests).
 */
function getInitialIsMobile(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(getInitialIsMobile)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
