import { useEffect, useState } from "react"

/**
 * Watches for a new service worker version and renders a small banner
 * prompting the user to reload. Pairs with the `SKIP_WAITING` listener in
 * `src/sw.ts`. Without this, vite-plugin-pwa's `autoUpdate` registers the
 * new SW but it only activates when all tabs close — meaning staff phones
 * can hold a stale build for hours.
 */
export function UpdateAvailableBanner() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return
    }

    let cancelled = false

    const handleNewWorker = (worker: ServiceWorker | null) => {
      if (!worker || cancelled) return
      const onStateChange = () => {
        // A new worker has finished installing AND we already have an
        // active controller — i.e. this is an update, not a first install.
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          setWaitingWorker(worker)
        }
      }
      worker.addEventListener("statechange", onStateChange)
    }

    navigator.serviceWorker.ready
      .then((registration) => {
        if (cancelled) return
        // If a worker is already waiting (we missed the install event,
        // e.g. the page just loaded after an update), surface it now.
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting)
        }
        registration.addEventListener("updatefound", () => {
          handleNewWorker(registration.installing)
        })
      })
      .catch(() => {
        // SW not available (e.g. dev without HTTPS, or unsupported browser)
      })

    // When the new SW takes over (after SKIP_WAITING), reload to load fresh assets.
    const onControllerChange = () => {
      if (waitingWorker) {
        window.location.reload()
      }
    }
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)

    return () => {
      cancelled = true
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
    }
    // We intentionally exclude `waitingWorker` from deps so the controller
    // listener is registered only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!waitingWorker) return null

  const handleUpdate = () => {
    waitingWorker.postMessage({ type: "SKIP_WAITING" })
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-center gap-3 border-t border-primary/30 bg-primary px-4 py-3 text-sm text-primary-foreground shadow-lg sm:bottom-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:rounded-md sm:border"
    >
      <span className="font-medium">A new version is available.</span>
      <button
        onClick={handleUpdate}
        className="rounded bg-primary-foreground px-3 py-1 text-xs font-semibold text-primary hover:opacity-90"
      >
        Update
      </button>
    </div>
  )
}
