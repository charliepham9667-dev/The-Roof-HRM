import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/authStore"

export interface Project {
  id: string
  title: string
  description: string | null
  owner_id: string | null
  status: "active" | "completed" | "on_hold" | "cancelled"
  priority: "low" | "medium" | "high" | "urgent"
  color: string
  due_date: string | null
  progress: number
  created_at: string
  updated_at: string
  // Computed from tasks
  task_count?: number
  completed_task_count?: number
  owner?: { id: string; full_name: string }
}

export function useProjects() {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          `
          *,
          owner:profiles!projects_owner_id_fkey(id, full_name)
        `,
        )
        .in("status", ["active", "on_hold"])
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })

      if (error) throw error
      return data as Project[]
    },
    enabled: !!profile,
  })

  const createProject = useMutation({
    mutationFn: async (project: Partial<Project>) => {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          ...project,
          owner_id: profile?.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })

  const updateProject = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Project> & { id: string }) => {
      const { data, error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })

  return {
    projects,
    isLoading,
    error,
    createProject,
    updateProject,
    deleteProject,
  }
}

export function useProjectWithTasks(projectId: string | null) {
  const profile = useAuthStore((s) => s.profile)

  return useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      if (!projectId) return null

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select(
          `
          *,
          owner:profiles!projects_owner_id_fkey(id, full_name)
        `,
        )
        .eq("id", projectId)
        .single()

      if (projectError) throw projectError

      const { data: tasks, error: tasksError } = await supabase
        .from("delegation_tasks")
        .select(
          `
          *,
          assignee:profiles!delegation_tasks_assigned_to_fkey(id, full_name)
        `,
        )
        .eq("project_id", projectId)
        .order("priority", { ascending: false })
        .order("due_date", { ascending: true })

      if (tasksError) throw tasksError

      return { ...project, tasks }
    },
    enabled: !!profile && !!projectId,
  })
}

