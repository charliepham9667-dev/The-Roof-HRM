export function SectionTitle({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-xs font-medium tracking-widest text-muted-foreground uppercase whitespace-nowrap">
        {label}
      </div>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}
