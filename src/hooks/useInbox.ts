import { useEffect, useState } from 'react'
import { reservationClient } from '@/lib/reservationClient'

export interface Conversation {
  id: string
  chat_id: string
  channel: string
  guest_name: string | null
  phone: string | null
  status: string
  escalated: boolean
  unread_count: number
  last_message_at: string
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender: 'guest' | 'ai' | 'staff'
  body: string
  created_at: string
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!reservationClient) { setLoading(false); return }

    async function load() {
      const { data } = await reservationClient!
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false })
        .limit(100)
      setConversations((data as Conversation[]) || [])
      setLoading(false)
    }

    load()

    const channel = reservationClient
      .channel('conversations-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => load())
      .subscribe()

    return () => { reservationClient!.removeChannel(channel) }
  }, [])

  return { conversations, loading }
}

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!conversationId || !reservationClient) { setMessages([]); return }
    setLoading(true)

    async function load() {
      const { data } = await reservationClient!
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      setMessages((data as Message[]) || [])
      setLoading(false)
    }

    load()

    const channel = reservationClient
      .channel(`messages-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message])
      })
      .subscribe()

    return () => { reservationClient!.removeChannel(channel) }
  }, [conversationId])

  return { messages, loading }
}

export async function sendStaffMessage(conversationId: string, phone: string, body: string): Promise<void> {
  if (!reservationClient) throw new Error('Reservation client not configured')
  const { error } = await reservationClient.functions.invoke('send-whatsapp', {
    body: { conversation_id: conversationId, to: phone, message: body },
  })
  if (error) throw new Error(error.message || 'Failed to send message')
}
