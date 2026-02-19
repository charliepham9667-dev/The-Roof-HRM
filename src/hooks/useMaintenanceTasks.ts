import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export type MaintenancePriority = 'high' | 'medium' | 'low'
export type MaintenanceStatus = 'open' | 'in_progress' | 'done'
export type MaintenanceCategory = 'electrical' | 'plumbing' | 'structural' | 'equipment' | 'aesthetic' | 'safety' | 'other'

export interface MaintenanceTask {
  id: string
  title: string
  description: string | null
  category: MaintenanceCategory
  priority: MaintenancePriority
  status: MaintenanceStatus
  location: string | null
  estimatedCost: number | null
  reportedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateMaintenanceTaskInput {
  title: string
  description?: string | null
  category?: MaintenanceCategory
  priority?: MaintenancePriority
  status?: MaintenanceStatus
  location?: string | null
  estimatedCost?: number | null
}

function mapTask(row: any): MaintenanceTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    location: row.location,
    estimatedCost: row.estimated_cost,
    reportedBy: row.reported_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function useMaintenanceTasks(
  priorityFilter?: MaintenancePriority | 'all',
  statusFilter?: MaintenanceStatus | 'all',
  categoryFilter?: MaintenanceCategory | 'all',
) {
  return useQuery({
    queryKey: ['maintenance-tasks', priorityFilter, statusFilter, categoryFilter],
    queryFn: async (): Promise<MaintenanceTask[]> => {
      let query = supabase
        .from('maintenance_tasks')
        .select('*')
        .order('created_at', { ascending: false })

      if (priorityFilter && priorityFilter !== 'all') query = query.eq('priority', priorityFilter)
      if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter)
      if (categoryFilter && categoryFilter !== 'all') query = query.eq('category', categoryFilter)

      const { data, error } = await query
      if (error) throw error
      return (data || []).map(mapTask)
    },
  })
}

export function useCreateMaintenanceTask() {
  const queryClient = useQueryClient()
  const profile = useAuthStore((s) => s.profile)

  return useMutation({
    mutationFn: async (input: CreateMaintenanceTaskInput) => {
      const { data, error } = await supabase
        .from('maintenance_tasks')
        .insert({
          title: input.title,
          description: input.description ?? null,
          category: input.category ?? 'other',
          priority: input.priority ?? 'medium',
          status: input.status ?? 'open',
          location: input.location ?? null,
          estimated_cost: input.estimatedCost ?? null,
          reported_by: profile?.id ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return mapTask(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] })
    },
  })
}

export function useUpdateMaintenanceTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateMaintenanceTaskInput> & { id: string }) => {
      const updateData: any = { updated_at: new Date().toISOString() }
      if (input.title !== undefined) updateData.title = input.title
      if (input.description !== undefined) updateData.description = input.description
      if (input.category !== undefined) updateData.category = input.category
      if (input.priority !== undefined) updateData.priority = input.priority
      if (input.status !== undefined) updateData.status = input.status
      if (input.location !== undefined) updateData.location = input.location
      if (input.estimatedCost !== undefined) updateData.estimated_cost = input.estimatedCost

      const { data, error } = await supabase
        .from('maintenance_tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return mapTask(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] })
    },
  })
}

export function useDeleteMaintenanceTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('maintenance_tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] })
    },
  })
}
