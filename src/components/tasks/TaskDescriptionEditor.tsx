interface TaskDescriptionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Markdown-enabled description editor with formatting hint.
 */
export function TaskDescriptionEditor({
  value,
  onChange,
  placeholder = "Add a description…",
  className = "",
}: TaskDescriptionEditorProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={6}
        className="w-full min-h-[120px] resize-y rounded-sm border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-border/80"
      />
      <p className="text-[10px] text-muted-foreground">
        Use Markdown for structure: <code className="rounded bg-muted px-0.5">## Heading</code>,{" "}
        <code className="rounded bg-muted px-0.5">- list</code>,{" "}
        <code className="rounded bg-muted px-0.5">1. numbered</code>
      </p>
    </div>
  );
}
