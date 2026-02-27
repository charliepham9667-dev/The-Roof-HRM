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

function dmQueryKey(channelId: string, myId: string) {
  return ['chat_messages', channelId, myId]
}

export function useChatMessages(channelId: string, myId?: string) {
  const queryClient = useQueryClient()
  const isDm = channelId.startsWith('@')
  const outboundChannel = isDm ? channelId : null
  const inboundChannel = isDm && myId ? `@${myId}` : null
  const dmChannels = [outboundChannel, inboundChannel].filter(Boolean) as string[]
  const effectiveKey = isDm && myId ? dmQueryKey(channelId, myId) : queryKey(channelId)

  const query = useQuery({
    queryKey: effectiveKey,
    queryFn: async () => {
      if (isDm && myId && dmChannels.length > 0) {
        // DM: fetch both directions and merge
        const [res1, res2] = await Promise.all([
          supabase
            .from('chat_messages')
            .select('id, channel_id, author_id, body, created_at, author:profiles(full_name, avatar_url)')
            .eq('channel_id', dmChannels[0])
            .order('created_at', { ascending: true })
            .limit(200),
          dmChannels[1]
            ? supabase
                .from('chat_messages')
                .select('id, channel_id, author_id, body, created_at, author:profiles(full_name, avatar_url)')
                .eq('channel_id', dmChannels[1])
                .order('created_at', { ascending: true })
                .limit(200)
            : { data: [], error: null },
        ])
        if (res1.error) throw res1.error
        if (res2.error) throw res2.error
        const merged = [...(res1.data ?? []), ...(res2.data ?? [])]
        merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        return merged as unknown as ChatMessage[]
      }

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

    const channelsToSub = isDm && myId ? dmChannels : [channelId]
    const unsubs: (() => void)[] = []

    for (const ch of channelsToSub) {
      const sub = supabase
        .channel(`chat_messages:${ch}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `channel_id=eq.${ch}`,
          },
          async (payload) => {
            const { data } = await supabase
              .from('chat_messages')
              .select('id, channel_id, author_id, body, created_at, author:profiles(full_name, avatar_url)')
              .eq('id', payload.new.id)
              .single()

            if (data) {
              const msg = data as unknown as ChatMessage
              queryClient.setQueryData<ChatMessage[]>(effectiveKey, (prev) => {
                if (!prev) return [msg]
                if (prev.some((m) => m.id === msg.id)) return prev
                const next = [...prev, msg]
                next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                return next
              })
            }
          },
        )
        .subscribe()
      unsubs.push(() => sub.unsubscribe())
    }

    return () => {
      unsubs.forEach((u) => u())
    }
  }, [channelId, myId, isDm, dmChannels.join(','), queryClient, effectiveKey])

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
      const addToCache = (key: string[]) => {
        queryClient.setQueryData<ChatMessage[]>(key, (prev) => {
          if (!prev) return [newMsg]
          if (prev.some((m) => m.id === newMsg.id)) return prev
          const next = [...prev, newMsg]
          next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          return next
        })
      }
      addToCache(queryKey(newMsg.channel_id))
      if (newMsg.channel_id.startsWith('@')) {
        addToCache(dmQueryKey(newMsg.channel_id, newMsg.author_id))
      }

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
