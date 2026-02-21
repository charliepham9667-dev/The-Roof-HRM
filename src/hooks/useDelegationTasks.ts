import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { DelegationTask, CreateDelegationTaskInput, TaskStatus, TaskPriority } from '../types';
import { insertNotifications } from './useNotifications';

// Get tasks assigned to current user
export function useMyAssignedTasks() {
  const profile = useAuthStore((s) => s.profile);

  return useQuery({
    queryKey: ['delegation-tasks', 'mine', profile?.id],
    queryFn: async (): Promise<DelegationTask[]> => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from('delegation_tasks')
        .select(`
          *,
          assigned_by_profile:assigned_by (full_name, email, avatar_url)
          ,project:projects(id, title, color)
        `)
        .eq('assigned_to', profile.id)
        .in('status', ['todo', 'in_progress', 'blocked'])
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...mapDelegationTask(row),
        assignedByProfile: row.assigned_by_profile ? {
          id: row.assigned_by,
          fullName: row.assigned_by_profile.full_name,
          email: row.assigned_by_profile.email,
          avatarUrl: row.assigned_by_profile.avatar_url,
        } : undefined,
      }));
    },
    enabled: !!profile?.id,
  });
}

// Get completed tasks assigned to current user
export function useMyCompletedTasks() {
  const profile = useAuthStore((s) => s.profile)

  return useQuery({
    queryKey: ['delegation-tasks', 'mine-completed', profile?.id],
    queryFn: async (): Promise<DelegationTask[]> => {
      if (!profile?.id) return []

      const { data, error } = await supabase
        .from('delegation_tasks')
        .select(`
          *,
          assigned_by_profile:assigned_by (full_name, email, avatar_url)
          ,project:projects(id, title, color)
        `)
        .eq('assigned_to', profile.id)
        .in('status', ['done', 'cancelled'])
        .order('completed_at', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(25)

      if (error) throw error

      return (data || []).map((row: any) => ({
        ...mapDelegationTask(row),
        assignedByProfile: row.assigned_by_profile
          ? {
              id: row.assigned_by,
              fullName: row.assigned_by_profile.full_name,
              email: row.assigned_by_profile.email,
              avatarUrl: row.assigned_by_profile.avatar_url,
            }
          : undefined,
      }))
    },
    enabled: !!profile?.id,
  })
}

// Get tasks created by current user (owner view)
export function useMyCreatedTasks() {
  const profile = useAuthStore((s) => s.profile);

  return useQuery({
    queryKey: ['delegation-tasks', 'created', profile?.id],
    queryFn: async (): Promise<DelegationTask[]> => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from('delegation_tasks')
        .select(`
          *,
          assigned_to_profile:assigned_to (full_name, email, avatar_url, job_role)
          ,project:projects(id, title, color)
        `)
        .eq('assigned_by', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...mapDelegationTask(row),
        assignedToProfile: row.assigned_to_profile ? {
          id: row.assigned_to,
          fullName: row.assigned_to_profile.full_name,
          email: row.assigned_to_profile.email,
          avatarUrl: row.assigned_to_profile.avatar_url,
          jobRole: row.assigned_to_profile.job_role,
        } : undefined,
      }));
    },
    enabled: !!profile?.id,
  });
}

// Get all active tasks (for owner dashboard) — shows tasks created by OR assigned to the owner
export function useAllDelegationTasks(statusFilter?: TaskStatus[]) {
  const profile = useAuthStore((s) => s.profile);

  return useQuery({
    queryKey: ['delegation-tasks', 'all', profile?.id, statusFilter],
    queryFn: async (): Promise<DelegationTask[]> => {
      if (!profile?.id) return [];

      let query = supabase
        .from('delegation_tasks')
        .select(`
          *,
          assigned_by_profile:assigned_by (full_name, email),
          assigned_to_profile:assigned_to (full_name, email, job_role)
          ,project:projects(id, title, color)
        `)
        // Owner perspective: tasks they created or are assigned to them
        .or(`assigned_to.eq.${profile.id},assigned_by.eq.${profile.id}`)
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true, nullsFirst: false });

      if (statusFilter && statusFilter.length > 0) {
        query = query.in('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...mapDelegationTask(row),
        assignedByProfile: row.assigned_by_profile ? {
          id: row.assigned_by,
          fullName: row.assigned_by_profile.full_name,
          email: row.assigned_by_profile.email,
        } : undefined,
        assignedToProfile: row.assigned_to_profile ? {
          id: row.assigned_to,
          fullName: row.assigned_to_profile.full_name,
          email: row.assigned_to_profile.email,
          jobRole: row.assigned_to_profile.job_role,
        } : undefined,
      }));
    },
    enabled: !!profile?.id,
  });
}

// Get tasks for manager view — only tasks assigned to the current user (from owner or self-assigned)
export function useManagerTasks(statusFilter?: TaskStatus[]) {
  const profile = useAuthStore((s) => s.profile);

  return useQuery({
    queryKey: ['delegation-tasks', 'manager', profile?.id, statusFilter],
    queryFn: async (): Promise<DelegationTask[]> => {
      if (!profile?.id) return [];

      let query = supabase
        .from('delegation_tasks')
        .select(`
          *,
          assigned_by_profile:assigned_by (full_name, email, avatar_url),
          assigned_to_profile:assigned_to (full_name, email, job_role)
          ,project:projects(id, title, color)
        `)
        // Manager perspective: only tasks assigned to this user
        .eq('assigned_to', profile.id)
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true, nullsFirst: false });

      if (statusFilter && statusFilter.length > 0) {
        query = query.in('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...mapDelegationTask(row),
        assignedByProfile: row.assigned_by_profile ? {
          id: row.assigned_by,
          fullName: row.assigned_by_profile.full_name,
          email: row.assigned_by_profile.email,
          avatarUrl: row.assigned_by_profile.avatar_url,
        } : undefined,
        assignedToProfile: row.assigned_to_profile ? {
          id: row.assigned_to,
          fullName: row.assigned_to_profile.full_name,
          email: row.assigned_to_profile.email,
          jobRole: row.assigned_to_profile.job_role,
        } : undefined,
      }));
    },
    enabled: !!profile?.id,
  });
}

// Get completed tasks for manager view — tasks assigned to current user that are done
export function useManagerCompletedTasks() {
  const profile = useAuthStore((s) => s.profile);

  return useQuery({
    queryKey: ['delegation-tasks', 'manager-completed', profile?.id],
    queryFn: async (): Promise<DelegationTask[]> => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from('delegation_tasks')
        .select(`
          *,
          assigned_by_profile:assigned_by (full_name, email, avatar_url)
          ,project:projects(id, title, color)
        `)
        .eq('assigned_to', profile.id)
        .in('status', ['done', 'cancelled'])
        .order('completed_at', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(25);

      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...mapDelegationTask(row),
        assignedByProfile: row.assigned_by_profile ? {
          id: row.assigned_by,
          fullName: row.assigned_by_profile.full_name,
          email: row.assigned_by_profile.email,
          avatarUrl: row.assigned_by_profile.avatar_url,
        } : undefined,
      }));
    },
    enabled: !!profile?.id,
  });
}

// Get tasks assigned to OR created by the current user (Command Center view)
export function useMyTasks() {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['delegation-tasks', 'my', profile?.id],
    queryFn: async (): Promise<DelegationTask[]> => {
      if (!profile?.id) return []

      const { data, error } = await supabase
        .from('delegation_tasks')
        .select(`
          *,
          assigned_by_profile:assigned_by (full_name, email, avatar_url),
          assigned_to_profile:assigned_to (full_name, email, avatar_url, job_role)
          ,project:projects(id, title, color)
        `)
        .or(`assigned_to.eq.${profile.id},assigned_by.eq.${profile.id}`)
        .in('status', ['todo', 'in_progress', 'blocked'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('priority', { ascending: false })
        .limit(10)

      if (error) throw error

      return (data || []).map((row: any) => ({
        ...mapDelegationTask(row),
        assignedByProfile: row.assigned_by_profile
          ? {
              id: row.assigned_by,
              fullName: row.assigned_by_profile.full_name,
              email: row.assigned_by_profile.email,
              avatarUrl: row.assigned_by_profile.avatar_url,
            }
          : undefined,
        assignedToProfile: row.assigned_to_profile
          ? {
              id: row.assigned_to,
              fullName: row.assigned_to_profile.full_name,
              email: row.assigned_to_profile.email,
              avatarUrl: row.assigned_to_profile.avatar_url,
              jobRole: row.assigned_to_profile.job_role,
            }
          : undefined,
      }))
    },
    enabled: !!profile?.id,
  })

  const updateTask = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string
      status?: TaskStatus
      priority?: TaskPriority
    }) => {
      const updateData: any = { ...updates, updated_at: new Date().toISOString() }
      if (updates.status === 'done') {
        updateData.completed_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('delegation_tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegation-tasks'] })
    },
  })

  return { ...query, tasks: query.data ?? [], updateTask }
}

// Create delegation task (owner only)
export function useCreateDelegationTask() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  return useMutation({
    mutationFn: async (input: CreateDelegationTaskInput) => {
      if (!profile?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('delegation_tasks')
        .insert({
          title: input.title,
          description: input.description || null,
          assigned_by: profile.id,
          assigned_to: input.assignedTo,
          project_id: input.projectId ?? null,
          due_date: input.dueDate || null,
          due_time: input.dueTime || null,
          priority: input.priority || 'medium',
          category: input.category || 'general',
          status: input.status || 'todo',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['delegation-tasks'] });
      if (task.assigned_to && task.assigned_to !== task.assigned_by) {
        insertNotifications([{
          userId: task.assigned_to,
          title: `New task: ${task.title}`,
          body: task.description || undefined,
          notificationType: 'task_assigned',
          relatedType: 'task',
          relatedId: task.id,
        }]);
      }
    },
  });
}

// Update task status (by assignee)
export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      completionNotes,
    }: {
      id: string;
      status: TaskStatus;
      completionNotes?: string;
    }) => {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'done') {
        updateData.completed_at = new Date().toISOString();
      }
      if (completionNotes !== undefined) {
        updateData.completion_notes = completionNotes;
      }

      const { data, error } = await supabase
        .from('delegation_tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegation-tasks'] });
    },
  });
}

// Update full task (owner)
export function useUpdateDelegationTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<CreateDelegationTaskInput> & { 
      id: string; 
      status?: TaskStatus;
    }) => {
      const updateData: any = { updated_at: new Date().toISOString() };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.assignedTo !== undefined) updateData.assigned_to = input.assignedTo;
      if (input.projectId !== undefined) updateData.project_id = input.projectId;
      if (input.dueDate !== undefined) updateData.due_date = input.dueDate;
      if (input.dueTime !== undefined) updateData.due_time = input.dueTime;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.category !== undefined) updateData.category = input.category;
      if (input.status !== undefined) {
        updateData.status = input.status;
        if (input.status === 'done') {
          updateData.completed_at = new Date().toISOString();
        }
      }

      const { data, error } = await supabase
        .from('delegation_tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegation-tasks'] });
    },
  });
}

// Delete task (owner only)
export function useDeleteDelegationTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('delegation_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegation-tasks'] });
    },
  });
}

// Get task stats
export function useTaskStats() {
  return useQuery({
    queryKey: ['delegation-task-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delegation_tasks')
        .select('status, priority');

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        todo: 0,
        inProgress: 0,
        done: 0,
        blocked: 0,
        urgent: 0,
        overdue: 0,
      };

      (data || []).forEach((t: any) => {
        if (t.status === 'todo') stats.todo++;
        else if (t.status === 'in_progress') stats.inProgress++;
        else if (t.status === 'done') stats.done++;
        else if (t.status === 'blocked') stats.blocked++;

        if (t.priority === 'urgent' && t.status !== 'done') stats.urgent++;
      });

      return stats;
    },
  });
}

// Helper mapper
function mapDelegationTask(row: any): DelegationTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    assignedBy: row.assigned_by,
    assignedTo: row.assigned_to,
    projectId: row.project_id,
    project: row.project
      ? {
          id: row.project.id,
          title: row.project.title,
          color: row.project.color ?? null,
        }
      : undefined,
    dueDate: row.due_date,
    dueTime: row.due_time,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    category: row.category,
    completedAt: row.completed_at,
    completionNotes: row.completion_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
