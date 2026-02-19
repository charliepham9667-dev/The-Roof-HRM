import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export type WishlistPriority = 'high' | 'medium' | 'low'
export type WishlistStatus = 'request' | 'approved' | 'ordered' | 'delivered'

export interface WishlistItem {
  id: string
  title: string
  quantity: number
  estimatedCost: number | null
  priority: WishlistPriority
  status: WishlistStatus
  notes: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateWishlistItemInput {
  title: string
  quantity: number
  estimatedCost?: number | null
  priority?: WishlistPriority
  status?: WishlistStatus
  notes?: string | null
}

function mapWishlistItem(row: any): WishlistItem {
  return {
    id: row.id,
    title: row.title,
    quantity: row.quantity,
    estimatedCost: row.estimated_cost,
    priority: row.priority,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function useWishlistItems(priorityFilter?: WishlistPriority | 'all', statusFilter?: WishlistStatus | 'all') {
  return useQuery({
    queryKey: ['wishlist-items', priorityFilter, statusFilter],
    queryFn: async (): Promise<WishlistItem[]> => {
      let query = supabase
        .from('wishlist_items')
        .select('*')
        .order('created_at', { ascending: false })

      if (priorityFilter && priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter)
      }
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return (data || []).map(mapWishlistItem)
    },
  })
}

export function useCreateWishlistItem() {
  const queryClient = useQueryClient()
  const profile = useAuthStore((s) => s.profile)

  return useMutation({
    mutationFn: async (input: CreateWishlistItemInput) => {
      const { data, error } = await supabase
        .from('wishlist_items')
        .insert({
          title: input.title,
          quantity: input.quantity,
          estimated_cost: input.estimatedCost ?? null,
          priority: input.priority ?? 'medium',
          status: input.status ?? 'request',
          notes: input.notes ?? null,
          created_by: profile?.id ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return mapWishlistItem(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-items'] })
    },
  })
}

export function useUpdateWishlistItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateWishlistItemInput> & { id: string }) => {
      const updateData: any = { updated_at: new Date().toISOString() }
      if (input.title !== undefined) updateData.title = input.title
      if (input.quantity !== undefined) updateData.quantity = input.quantity
      if (input.estimatedCost !== undefined) updateData.estimated_cost = input.estimatedCost
      if (input.priority !== undefined) updateData.priority = input.priority
      if (input.status !== undefined) updateData.status = input.status
      if (input.notes !== undefined) updateData.notes = input.notes

      const { data, error } = await supabase
        .from('wishlist_items')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return mapWishlistItem(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-items'] })
    },
  })
}

export function useDeleteWishlistItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('wishlist_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-items'] })
    },
  })
}
