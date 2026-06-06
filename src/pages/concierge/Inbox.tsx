import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Send, Loader2, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useConversations, useMessages, sendStaffMessage, type Conversation } from '@/hooks/useInbox'
import { reservationClient } from '@/lib/reservationClient'

const CHANNEL_ICON: Record<string, string> = {
  whatsapp: '📱',
  instagram: '📸',
  facebook: '💬',
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function Inbox() {
  const { conversations, loading } = useConversations()
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [compose, setCompose] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const { messages, loading: msgLoading } = useMessages(selected?.id ?? null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isConfigured = !!reservationClient

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!compose.trim() || !selected || sending) return
    setSendError(null)
    setSending(true)
    try {
      await sendStaffMessage(selected.id, selected.phone ?? selected.chat_id, compose.trim())
      setCompose('')
    } catch (err: any) {
      setSendError(err.message || 'Send failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">AI Inbox</h1>
          <p className="text-xs text-muted-foreground">WhatsApp conversations · real-time</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {isConfigured
            ? <><Wifi className="h-3.5 w-3.5 text-emerald-500" /><span className="text-emerald-600">Live</span></>
            : <><WifiOff className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Not connected</span></>
          }
        </div>
      </div>

      {!isConfigured ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <div className="max-w-sm space-y-2">
            <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">Reservation system not connected</p>
            <p className="text-xs text-muted-foreground/70">
              Add <code className="rounded bg-muted px-1 py-0.5">VITE_RESERVATION_SUPABASE_URL</code> and{' '}
              <code className="rounded bg-muted px-1 py-0.5">VITE_RESERVATION_SUPABASE_ANON_KEY</code> to your environment.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Thread list */}
          <div className="shrink-0 w-72 flex flex-col border-r border-border overflow-hidden">
            <div className="shrink-0 border-b border-border px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Conversations
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">No conversations yet</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Messages will appear here when guests WhatsApp in</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelected(conv)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors',
                      selected?.id === conv.id ? 'bg-primary/8 border-l-2 border-l-primary' : 'hover:bg-muted/40'
                    )}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="text-sm">{CHANNEL_ICON[conv.channel] ?? '💬'}</span>
                          <span className="truncate text-xs font-semibold text-foreground">
                            {conv.guest_name || conv.phone || conv.chat_id}
                          </span>
                          {conv.unread_count > 0 && (
                            <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                        {conv.phone && conv.guest_name && (
                          <p className="text-[10px] text-muted-foreground truncate">{conv.phone}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[9px] text-muted-foreground/60">{timeAgo(conv.last_message_at)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Conversation */}
          <div className="flex flex-1 min-w-0 flex-col">
            {!selected ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Select a conversation</p>
                </div>
              </div>
            ) : (
              <>
                {/* Conv header */}
                <div className="shrink-0 flex items-center gap-2 border-b border-border px-4 py-2.5">
                  <span className="text-lg">{CHANNEL_ICON[selected.channel] ?? '💬'}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selected.guest_name || selected.phone || selected.chat_id}
                    </p>
                    {selected.phone && selected.guest_name && (
                      <p className="text-[10px] text-muted-foreground">{selected.phone}</p>
                    )}
                  </div>
                  <span className={cn(
                    'ml-auto rounded-full px-2 py-0.5 text-[9px] font-semibold border',
                    selected.status === 'open'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-muted text-muted-foreground border-border'
                  )}>
                    {selected.status}
                  </span>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {msgLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No messages yet</p>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn('flex', msg.sender === 'guest' ? 'justify-start' : 'justify-end')}
                      >
                        <div className={cn(
                          'max-w-[75%] rounded-lg px-3 py-2 text-xs',
                          msg.sender === 'guest'
                            ? 'bg-muted text-foreground rounded-tl-none'
                            : msg.sender === 'ai'
                            ? 'bg-primary/10 text-primary rounded-tr-none border border-primary/20'
                            : 'bg-primary text-primary-foreground rounded-tr-none'
                        )}>
                          {msg.sender !== 'guest' && (
                            <p className="text-[9px] font-bold uppercase opacity-60 mb-0.5">
                              {msg.sender === 'ai' ? 'AI' : 'Staff'}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap">{msg.body}</p>
                          <p className="text-[9px] opacity-50 mt-0.5 text-right">
                            {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Compose */}
                <div className="shrink-0 border-t border-border p-3">
                  {sendError && (
                    <p className="text-xs text-destructive mb-1.5">{sendError}</p>
                  )}
                  <div className="flex items-end gap-2">
                    <textarea
                      value={compose}
                      onChange={(e) => setCompose(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                      }}
                      placeholder="Type a message… (Enter to send)"
                      rows={2}
                      className="flex-1 resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!compose.trim() || sending}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
