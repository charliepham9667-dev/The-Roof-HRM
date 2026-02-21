import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { insertNotifications } from './useNotifications'

export interface ChatMessage {
  id: string
  channel_id: string
  author_id: string
  body: string
  created_at: string
  author?: {
    full_name: string | null
    avatar_url: string | null
  }
}

export interface SendMessageInput {
  channel_id: string
  author_id: string
  body: string
}

function queryKey(channelId: string) {
  return ['chat_messages', channelId]
}

export function useChatMessages(channelId: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKey(channelId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, channel_id, author_id, body, created_at, author:profiles(full_name, avatar_url)')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(200)

      if (error) throw error
      return (data ?? []) as unknown as ChatMessage[]
    },
    enabled: !!channelId,
  })

  // Real-time subscription: append new messages as they arrive
  useEffect(() => {
    if (!channelId) return

    const subscription = supabase
      .channel(`chat_messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          // Fetch the new row with author join so we have the name
          const { data } = await supabase
            .from('chat_messages')
            .select('id, channel_id, author_id, body, created_at, author:profiles(full_name, avatar_url)')
            .eq('id', payload.new.id)
            .single()

          if (data) {
            const msg = data as unknown as ChatMessage
            queryClient.setQueryData<ChatMessage[]>(queryKey(channelId), (prev) => {
              if (!prev) return [msg]
              // Avoid duplicates (optimistic insert may already be there)
              if (prev.some((m) => m.id === msg.id)) return prev
              return [...prev, msg]
            })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [channelId, queryClient])

  return query
}

export function useSendChatMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          channel_id: input.channel_id,
          author_id: input.author_id,
          body: input.body,
        })
        .select('id, channel_id, author_id, body, created_at, author:profiles(full_name, avatar_url)')
        .single()

      if (error) throw error
      return data as unknown as ChatMessage
    },
    onSuccess: (newMsg) => {
      // Optimistically add to cache so the message appears instantly
      queryClient.setQueryData<ChatMessage[]>(queryKey(newMsg.channel_id), (prev) => {
        if (!prev) return [newMsg]
        if (prev.some((m) => m.id === newMsg.id)) return prev
        return [...prev, newMsg]
      })

      // Notify DM recipient (channel_id starts with '@' for DMs)
      if (newMsg.channel_id.startsWith('@')) {
        const recipientId = newMsg.channel_id.slice(1)
        if (recipientId && recipientId !== newMsg.author_id) {
          const senderName = (newMsg.author as any)?.full_name || 'Someone'
          insertNotifications([{
            userId: recipientId,
            title: `New message from ${senderName}`,
            body: newMsg.body.length > 80 ? `${newMsg.body.slice(0, 80)}…` : newMsg.body,
            notificationType: 'announcement',
            relatedType: 'chat_dm',
            relatedId: newMsg.id,
          }])
        }
      }
    },
  })
}
