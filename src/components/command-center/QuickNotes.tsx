import { useState } from "react"
import { Pin, Plus, Trash2, X } from "lucide-react"

import { Button, Input, WidgetCard } from "@/components/ui"
import { useNotes } from "@/hooks/useNotes"
import { cn } from "@/lib/utils"

export function QuickNotes({ title = "Quick Notes" }: { title?: string }) {
  const { notes, isLoading, createNote, deleteNote, togglePin } = useNotes()
  const [isAdding, setIsAdding] = useState(false)
  const [newNote, setNewNote] = useState("")

  const handleAddNote = async () => {
    if (!newNote.trim()) return

    try {
      await createNote.mutateAsync(newNote.trim())
      setNewNote("")
      setIsAdding(false)
    } catch (error) {
      console.error("Failed to create note:", error)
    }
  }

  return (
    <WidgetCard
      title={title}
      icon={Pin}
      headerAction={
        !isAdding ? (
          <Button variant="ghost" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        ) : null
      }
    >
      {isAdding && (
        <div className="mb-3 flex gap-2">
          <Input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a quick note..."
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddNote()
              if (e.key === "Escape") setIsAdding(false)
            }}
            autoFocus
          />
          <Button size="sm" onClick={handleAddNote} disabled={createNote.isPending}>
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="py-4 text-center text-muted-foreground">Loading...</div>
      ) : notes.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-muted-foreground">No notes yet</p>
          {!isAdding && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setIsAdding(true)}
            >
              Add your first note
            </Button>
          )}
        </div>
      ) : (
        <div className="max-h-[200px] space-y-2 overflow-y-auto">
          {notes.slice(0, 5).map((note) => (
            <div
              key={note.id}
              className={cn(
                "group flex items-start gap-2 rounded-lg border border-border p-2",
                "transition-colors hover:bg-muted/50",
                note.is_pinned && "border-primary/20 bg-primary/5",
              )}
            >
              <p className="line-clamp-2 flex-1 text-sm text-foreground">{note.content}</p>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => togglePin.mutate({ id: note.id, is_pinned: note.is_pinned })}
                >
                  <Pin
                    className={cn("h-3 w-3", note.is_pinned && "fill-primary text-primary")}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-error"
                  onClick={() => deleteNote.mutate(note.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}

