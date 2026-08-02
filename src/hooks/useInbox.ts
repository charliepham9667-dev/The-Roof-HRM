import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reservationClient, gatewayFetch } from '@/lib/reservationClient'

export interface Conversation {
  id: string
  chat_id: string
  channel: 'whatsapp' | 'instagram' | 'facebook' | 'email' | string
  guest_name: string | null
  phone: string | null
  email: string | null
  subject: string | null
  last_message_body: string | null
  last_sender: string | null
  status: 'open' | 'resolved'
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
  return useQuery({
    queryKey: ['inbox-conversations'],
    queryFn: async (): Promise<Conversation[]> => {
      return (await gatewayFetch<Conversation[]>('conversations')) ?? []
    },
    refetchInterval: 15000,
    staleTime: 10000,
  })
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['inbox-messages', conversationId],
    queryFn: async (): Promise<Message[]> => {
      if (!conversationId) return []
      return (await gatewayFetch<Message[]>('messages', { conversation_id: conversationId })) ?? []
    },
    enabled: !!conversationId,
    refetchInterval: 8000,
    staleTime: 5000,
  })
}

export function useGuestReservations(phone: string | null, email: string | null = null) {
  return useQuery({
    queryKey: ['guest-reservations', phone, email],
    queryFn: async () => {
      if (!phone && !email) return []
      return (await gatewayFetch<any[]>('guest-reservations', { phone, email })) ?? []
    },
    enabled: !!(phone || email),
    staleTime: 60000,
  })
}

export function useSendInboxMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ conversation_id, body }: { conversation_id: string; body: string }) => {
      if (!reservationClient) throw new Error('Reservation client not configured')
      const { error } = await reservationClient.functions.invoke('send-inbox-message', {
        body: { conversation_id, body },
      })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inbox-messages', variables.conversation_id] })
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] })
    },
  })
}

export function useResolveConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await gatewayFetch<{ ok: boolean }>(
        'resolve-conversation', {}, { method: 'POST', body: { id } },
      )
      if (!res?.ok) throw new Error('Failed to resolve conversation')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] }),
  })
}
