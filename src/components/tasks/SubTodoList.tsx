import { CheckSquare, Square, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { SubTodo } from "@/types";
import { cn } from "@/lib/utils";

const MAX_ITEMS = 20;

/** Author mode: add/edit/remove sub-todos */
interface SubTodoListEditorProps {
  items: SubTodo[];
  onChange: (items: SubTodo[]) => void;
  disabled?: boolean;
}

export function SubTodoListEditor({ items, onChange, disabled }: SubTodoListEditorProps) {
  const [newText, setNewText] = useState("");

  function addItem() {
    const trimmed = newText.trim();
    if (!trimmed || items.length >= MAX_ITEMS) return;
    onChange([
      ...items,
      { id: crypto.randomUUID(), text: trimmed, completed: false },
    ]);
    setNewText("");
  }

  function removeItem(id: string) {
    onChange(items.filter((t) => t.id !== id));
  }

  function setItemText(id: string, text: string) {
    onChange(
      items.map((t) => (t.id === id ? { ...t, text } : t))
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground px-1">Sub-tasks</div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 rounded-sm border border-border bg-transparent px-3 py-2"
          >
            <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={item.text}
              onChange={(e) => setItemText(item.id, e.target.value)}
              placeholder="Sub-task…"
              className="flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
              disabled={disabled}
            />
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
              disabled={disabled}
              aria-label="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {items.length < MAX_ITEMS && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
              placeholder="Add sub-task…"
              className="flex-1 min-w-0 rounded-sm border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-border/80"
              disabled={disabled}
            />
            <button
              type="button"
              onClick={addItem}
              disabled={!newText.trim() || disabled}
              className="shrink-0 rounded-sm border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
              aria-label="Add"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Assignee mode: interactive checkboxes */
interface SubTodoListDisplayProps {
  items: SubTodo[];
  onToggle: (id: string, completed: boolean) => void;
  disabled?: boolean;
}

export function SubTodoListDisplay({ items, onToggle, disabled }: SubTodoListDisplayProps) {
  if (!items.length) return null;

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground px-1">Sub-tasks</div>
      <div className="space-y-1.5">
        {items.map((item) => {
          const displayText = item.text.length > 80 ? `${item.text.slice(0, 80)}…` : item.text;
          return (
            <div
              key={item.id}
              className={cn(
                "flex items-start gap-2 rounded-sm px-2 py-1.5 transition-colors",
                item.completed && "opacity-60"
              )}
            >
              <button
                type="button"
                onClick={() => onToggle(item.id, !item.completed)}
                disabled={disabled}
                className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
              >
                {item.completed ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>
              <span
                title={item.text.length > 80 ? item.text : undefined}
                className={cn(
                  "flex-1 text-sm text-foreground",
                  item.completed && "line-through text-muted-foreground"
                )}
              >
                {displayText}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
