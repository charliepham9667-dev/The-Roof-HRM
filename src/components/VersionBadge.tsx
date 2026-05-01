/**
 * Tiny build-version badge. Lets staff include a version when reporting bugs
 * ("the app is broken on my phone — version 2026-05-01 a1b2c3d") so we can
 * correlate reports with deploys. Sourced from build-time constants in
 * `vite.config.ts`.
 */
export function VersionBadge() {
  const commit = typeof __APP_COMMIT__ !== "undefined" ? __APP_COMMIT__ : "dev"
  const builtAt = typeof __APP_BUILT_AT__ !== "undefined" ? __APP_BUILT_AT__ : ""

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none px-4 py-2 text-center text-[10px] tracking-wide text-muted-foreground/60"
    >
      v{builtAt} · {commit}
    </div>
  )
}
