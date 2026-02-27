import ReactMarkdown from "react-markdown";

interface TaskDescriptionDisplayProps {
  description?: string | null;
  className?: string;
}

/**
 * Renders task description as formatted Markdown with prose styling for readability.
 */
export function TaskDescriptionDisplay({ description, className = "" }: TaskDescriptionDisplayProps) {
  if (!description?.trim()) return null;

  return (
    <div
      className={`max-w-none text-foreground [&_*]:text-foreground ${className}`}
      style={{ lineHeight: 1.6 }}
    >
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 text-sm text-foreground">{children}</p>
          ),
          h1: ({ children }) => (
            <h1 className="text-base font-semibold mt-4 mb-1 first:mt-0 text-foreground">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-semibold mt-3 mb-1 first:mt-0 text-foreground">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-medium mt-2 mb-1 text-foreground">{children}</h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-2 space-y-0.5 text-sm text-foreground">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-2 space-y-0.5 text-sm text-foreground">{children}</ol>
          ),
          li: ({ children }) => <li className="text-foreground">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground italic text-sm">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">{children}</code>
          ),
        }}
      >
        {description}
      </ReactMarkdown>
    </div>
  );
}
