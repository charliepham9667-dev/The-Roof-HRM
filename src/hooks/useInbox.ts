import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reservationClient } from '@/lib/reservationClient'

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
      if (!reservationClient) return []
      const { data, error } = await reservationClient
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false })
      if (error) { console.error('[useConversations]', error); return [] }
      return data ?? []
    },
    refetchInterval: 15000,
    staleTime: 10000,
  })
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['inbox-messages', conversationId],
    queryFn: async (): Promise<Message[]> => {
      if (!reservationClient || !conversationId) return []
      const { data, error } = await reservationClient
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (error) { console.error('[useMessages]', error); return [] }
      return data ?? []
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
      if (!reservationClient || (!phone && !email)) return []
      let query = reservationClient
        .from('reservations')
        .select('id, name, requested_date, requested_time, party_size, status, package')
        .order('requested_date', { ascending: false })
        .limit(10)
      if (phone && email) {
        query = query.or(`phone.eq.${phone},email.eq.${email}`)
      } else if (phone) {
        query = query.eq('phone', phone)
      } else {
        query = query.eq('email', email!)
      }
      const { data, error } = await query
      if (error) { console.error('[useGuestReservations]', error); return [] }
      return data ?? []
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
      if (!reservationClient) throw new Error('No client')
      const { error } = await reservationClient
        .from('conversations')
        .update({ status: 'resolved', unread_count: 0 })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] }),
  })
}
