import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { WidgetCard } from "@/components/ui/widget-card"

export interface OwnerTodoItem {
  id: string
  text: string
  done: boolean
}

export interface OwnerTodoListCardProps {
  storageKey?: string
  className?: string
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export function OwnerTodoListCard({
  storageKey = "owner-todos",
  className,
}: OwnerTodoListCardProps) {
  const [items, setItems] = useState<OwnerTodoItem[]>([])
  const [text, setText] = useState("")

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as OwnerTodoItem[]
      if (Array.isArray(parsed)) setItems(parsed)
    } catch {
      // ignore
    }
  }, [storageKey])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items))
    } catch {
      // ignore
    }
  }, [items, storageKey])

  const completed = useMemo(() => items.filter((i) => i.done).length, [items])
  const total = items.length
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100)

  const add = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    setItems((prev) => [{ id: uid(), text: trimmed, done: false }, ...prev])
    setText("")
  }

  return (
    <WidgetCard
      className={className}
      title="Today's focus"
      subtitle="Owner to-do list"
      headerAction={
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {completed}/{total}
          </span>
          <span>{progress}%</span>
        </div>
      }
    >
      <div className="space-y-4">
        <Progress value={progress} className="h-2" />

        <div className="flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add()
            }}
            placeholder="Add a focus item…"
          />
          <Button onClick={add} className="shrink-0">
            Add
          </Button>
        </div>

        {total === 0 ? (
          <div className="text-sm text-muted-foreground">
            Add 2–3 priorities for today.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-control px-2 py-2 hover:bg-muted/40">
                <Checkbox
                  checked={item.done}
                  onCheckedChange={(checked) =>
                    setItems((prev) =>
                      prev.map((p) =>
                        p.id === item.id ? { ...p, done: Boolean(checked) } : p
                      )
                    )
                  }
                  className="mt-0.5"
                />
                <div className="flex-1 text-sm">
                  <div className={item.done ? "text-muted-foreground line-through" : "text-foreground"}>
                    {item.text}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setItems((prev) => prev.filter((p) => p.id !== item.id))}
                  aria-label="Remove item"
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetCard>
  )
}

