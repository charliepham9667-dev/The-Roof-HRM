import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const READ_STATE_KEY = ['chat_conversation_read']
const DM_LIST_KEY = ['chat_dm_list']

export interface DMContactMetadata {
  peerId: string
  lastMessage: string
  lastTime: string
  unread: number
  lastMessageAuthorName?: string
}

/** Mark the current user as having read the conversation with this peer. */
export function useMarkConversationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, peerId }: { userId: string; peerId: string }) => {
      const { error } = await supabase
        .from('chat_conversation_read')
        .upsert(
          { user_id: userId, peer_id: peerId, last_read_at: new Date().toISOString() },
          { onConflict: 'user_id,peer_id' }
        )
      if (error) {
        console.warn('[useMarkConversationRead] upsert error (table may not exist yet):', error.message)
        // Don't re-throw — marking read is best-effort; missing table should not crash the UI
      }
    },
    onSuccess: (_, { peerId }) => {
      queryClient.invalidateQueries({ queryKey: [...READ_STATE_KEY, peerId] })
      queryClient.invalidateQueries({ queryKey: DM_LIST_KEY })
    },
  })
}

/** Fetch the recipient's last_read_at for this conversation (for "Seen" on my sent messages). */
export function useRecipientReadState(recipientId: string | null, myId: string | undefined, isDm: boolean) {
  return useQuery({
    queryKey: [...READ_STATE_KEY, 'recipient', recipientId, myId],
    queryFn: async (): Promise<string | null> => {
      if (!recipientId || !myId) return null
      // Recipient (peer) has read when (recipient_id, my_id).last_read_at exists
      const { data, error } = await supabase
        .from('chat_conversation_read')
        .select('last_read_at')
        .eq('user_id', recipientId)
        .eq('peer_id', myId)
        .maybeSingle()
      if (error) {
        console.warn('[useRecipientReadState] query error (table may not exist yet):', error.message)
        return null
      }
      return data?.last_read_at ?? null
    },
    enabled: !!recipientId && !!myId && isDm,
    refetchInterval: 10_000,
  })
}

/** Fetch last message, lastTime, and unread count for each DM contact. */
export function useDMListMetadata(profileId: string | undefined, peerIds: string[]) {
  const myChannel = profileId ? `@${profileId}` : null
  const enabled = !!profileId && peerIds.length > 0

  return useQuery({
    queryKey: [...DM_LIST_KEY, profileId, peerIds.sort().join(',')],
    queryFn: async (): Promise<Record<string, DMContactMetadata>> => {
      if (!profileId || !myChannel) return {}

      const peerChannels = peerIds.map((p) => `@${p}`)

      // 1. Inbound messages (to me) + per-peer last_read_at
      const [inboundRes, readRes, outboundRes] = await Promise.all([
        supabase
          .from('chat_messages')
          .select('id, channel_id, author_id, body, created_at, author:profiles(full_name)')
          .eq('channel_id', myChannel)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('chat_conversation_read')
          .select('peer_id, last_read_at')
          .eq('user_id', profileId)
          .in('peer_id', peerIds),
        supabase
          .from('chat_messages')
          .select('id, channel_id, body, created_at')
          .in('channel_id', peerChannels)
          .eq('author_id', profileId)
          .order('created_at', { ascending: false })
          .limit(peerChannels.length * 50),
      ])

      // Soft-fail: if the table doesn't exist yet or RLS blocks the query, return empty metadata
      if (inboundRes.error) {
        console.warn('[useDMListMetadata] inbound query error (table may not exist yet):', inboundRes.error.message)
        return {}
      }
      if (readRes.error) {
        // Soft-fail: if chat_conversation_read doesn't exist yet, continue with empty read state
        // rather than aborting all DM metadata (which would leave lastMessage data stale/bleeding)
        console.warn('[useDMListMetadata] read state query error (chat_conversation_read may not exist yet):', readRes.error.message)
      }
      if (outboundRes.error) {
        // Soft-fail: missing outbound messages shouldn't abort inbound DM metadata
        console.warn('[useDMListMetadata] outbound query error:', outboundRes.error.message)
      }

      const lastReadPerPeer: Record<string, number> = {}
      for (const row of readRes.data ?? []) {
        const r = row as { peer_id: string; last_read_at: string }
        lastReadPerPeer[r.peer_id] = new Date(r.last_read_at).getTime()
      }
      type InboundRow = { author_id: string; body: string; created_at: string; author?: unknown }
      const inbound = (inboundRes.data ?? []) as InboundRow[]
      const outbound = (outboundRes.data ?? []) as Array<{ channel_id: string; body: string; created_at: string }>

      const result: Record<string, DMContactMetadata> = {}
      for (const peerId of peerIds) {
        result[peerId] = {
          peerId,
          lastMessage: '',
          lastTime: '',
          unread: 0,
        }
      }

      // Latest message per conversation (from either direction)
      const latestPerPeer: Record<string, { body: string; createdAt: string; authorName?: string }> = {}

      for (const m of inbound) {
        const peerId = m.author_id
        if (!peerIds.includes(peerId)) continue
        const ts = new Date(m.created_at).getTime()
        const existing = latestPerPeer[peerId]
        if (!existing || ts > new Date(existing.createdAt).getTime()) {
          const auth = m.author as { full_name?: string | null } | null
          latestPerPeer[peerId] = {
            body: m.body,
            createdAt: m.created_at,
            authorName: auth?.full_name ?? undefined,
          }
        }
        const lastRead = lastReadPerPeer[peerId] ?? 0
        if (ts > lastRead && peerId !== profileId) {
          result[peerId].unread++
        }
      }

      for (const m of outbound) {
        const peerId = m.channel_id.slice(1)
        if (!peerIds.includes(peerId)) continue
        const ts = new Date(m.created_at).getTime()
        const existing = latestPerPeer[peerId]
        if (!existing || ts > new Date(existing.createdAt).getTime()) {
          latestPerPeer[peerId] = { body: m.body, createdAt: m.created_at, authorName: undefined }
        }
      }

      for (const peerId of peerIds) {
        const latest = latestPerPeer[peerId]
        if (latest) {
          result[peerId].lastMessage = latest.body
          result[peerId].lastTime = formatLastTime(latest.createdAt)
          result[peerId].lastMessageAuthorName = latest.authorName
        }
      }

      return result
    },
    enabled,
    staleTime: 5000,
  })
}

function formatLastTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 2) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const today = now.toDateString()
  const yesterday = new Date(now.getTime() - 86400000).toDateString()
  const msgDate = date.toDateString()

  if (msgDate === today) return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (msgDate === yesterday) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
