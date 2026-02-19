import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { TaskTemplate, TaskCompletion, CompletedTaskItem } from '../types';

// Get all active task templates
export function useTaskTemplates(taskType?: string) {
  return useQuery({
    queryKey: ['task-templates', taskType],
    queryFn: async (): Promise<TaskTemplate[]> => {
      let query = supabase
        .from('task_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (taskType) {
        query = query.eq('task_type', taskType);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(mapTaskTemplate);
    },
  });
}

// Get templates applicable to current user's role
export function useMyTaskTemplates(taskType?: string) {
  const profile = useAuthStore((s) => s.profile);
  const jobRole = profile?.jobRole || 'service';

  return useQuery({
    queryKey: ['my-task-templates', taskType, jobRole],
    queryFn: async (): Promise<TaskTemplate[]> => {
      let query = supabase
        .from('task_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (taskType) {
        query = query.eq('task_type', taskType);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by applicable roles (includes 'all' or user's role)
      return (data || [])
        .filter((t: any) => 
          t.applicable_roles.includes('all') || 
          t.applicable_roles.includes(jobRole)
        )
        .map(mapTaskTemplate);
    },
    enabled: !!profile,
  });
}

// Get today's task completions for current user
export function useTodayTaskCompletions() {
  const profile = useAuthStore((s) => s.profile);
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['task-completions', 'today', profile?.id],
    queryFn: async (): Promise<TaskCompletion[]> => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from('task_completions')
        .select(`
          *,
          task_templates (*)
        `)
        .eq('staff_id', profile.id)
        .eq('completion_date', today);

      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...mapTaskCompletion(row),
        template: row.task_templates ? mapTaskTemplate(row.task_templates) : undefined,
      }));
    },
    enabled: !!profile?.id,
  });
}

// Get or create a task completion for a template
export function useTaskCompletion(templateId: string) {
  const profile = useAuthStore((s) => s.profile);
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['task-completion', templateId, today, profile?.id],
    queryFn: async (): Promise<TaskCompletion | null> => {
      if (!profile?.id || !templateId) return null;

      const { data, error } = await supabase
        .from('task_completions')
        .select(`
          *,
          task_templates (*)
        `)
        .eq('staff_id', profile.id)
        .eq('template_id', templateId)
        .eq('completion_date', today)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        return {
          ...mapTaskCompletion(data),
          template: data.task_templates ? mapTaskTemplate(data.task_templates) : undefined,
        };
      }

      return null;
    },
    enabled: !!profile?.id && !!templateId,
  });
}

// Start or update a task completion
export function useUpdateTaskCompletion() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  return useMutation({
    mutationFn: async ({
      templateId,
      completedTasks,
      template,
      shiftId,
    }: {
      templateId: string;
      completedTasks: CompletedTaskItem[];
      template: TaskTemplate;
      shiftId?: string;
    }) => {
      if (!profile?.id) throw new Error('Not authenticated');

      const today = new Date().toISOString().split('T')[0];
      const totalTasks = template.tasks.length;
      const completedCount = completedTasks.length;
      const completionPercentage = Math.round((completedCount / totalTasks) * 100);
      const isFullyCompleted = completedCount === totalTasks;

      // Upsert the completion
      const { data, error } = await supabase
        .from('task_completions')
        .upsert({
          template_id: templateId,
          staff_id: profile.id,
          completion_date: today,
          shift_id: shiftId || null,
          completed_tasks: completedTasks,
          completion_percentage: completionPercentage,
          is_fully_completed: isFullyCompleted,
          submitted_at: isFullyCompleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'template_id,staff_id,completion_date',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-completions'] });
      queryClient.invalidateQueries({ queryKey: ['task-completion', variables.templateId] });
    },
  });
}

// Toggle a single task item
export function useToggleTaskItem() {
  const updateCompletion = useUpdateTaskCompletion();

  return useMutation({
    mutationFn: async ({
      template,
      currentCompletedTasks,
      taskName,
      shiftId,
    }: {
      template: TaskTemplate;
      currentCompletedTasks: CompletedTaskItem[];
      taskName: string;
      shiftId?: string;
    }) => {
      const isCompleted = currentCompletedTasks.some(t => t.taskName === taskName);
      
      let newCompletedTasks: CompletedTaskItem[];
      if (isCompleted) {
        // Remove the task
        newCompletedTasks = currentCompletedTasks.filter(t => t.taskName !== taskName);
      } else {
        // Add the task
        newCompletedTasks = [
          ...currentCompletedTasks,
          {
            taskName,
            completedAt: new Date().toISOString(),
          },
        ];
      }

      return updateCompletion.mutateAsync({
        templateId: template.id,
        completedTasks: newCompletedTasks,
        template,
        shiftId,
      });
    },
  });
}

// ── Admin mutations ──────────────────────────────────────────────────────────

export function useCreateTaskTemplate() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  return useMutation({
    mutationFn: async (payload: {
      name: string;
      description?: string;
      taskType: string;
      applicableRoles: string[];
      tasks: { name: string; description?: string; order: number }[];
    }) => {
      const { data, error } = await supabase
        .from('task_templates')
        .insert({
          name: payload.name,
          description: payload.description || null,
          task_type: payload.taskType,
          applicable_roles: payload.applicableRoles,
          tasks: payload.tasks,
          is_active: true,
          created_by: profile?.id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-templates'] }),
  });
}

export function useUpdateTaskTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      name: string;
      description?: string;
      taskType: string;
      applicableRoles: string[];
      tasks: { name: string; description?: string; order: number }[];
      isActive: boolean;
    }) => {
      const { data, error } = await supabase
        .from('task_templates')
        .update({
          name: payload.name,
          description: payload.description || null,
          task_type: payload.taskType,
          applicable_roles: payload.applicableRoles,
          tasks: payload.tasks,
          is_active: payload.isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-templates'] }),
  });
}

export function useDeleteTaskTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('task_templates')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-templates'] }),
  });
}

// Get task completion stats for a date range (for managers)
export function useTaskCompletionStats(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['task-completion-stats', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_completions')
        .select(`
          *,
          profiles:staff_id (full_name, email, job_role),
          task_templates (name, task_type)
        `)
        .gte('completion_date', startDate)
        .lte('completion_date', endDate)
        .order('completion_date', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...mapTaskCompletion(row),
        staff: row.profiles ? {
          id: row.staff_id,
          fullName: row.profiles.full_name,
          email: row.profiles.email,
          jobRole: row.profiles.job_role,
        } : undefined,
        template: row.task_templates ? {
          name: row.task_templates.name,
          taskType: row.task_templates.task_type,
        } : undefined,
      }));
    },
  });
}

// Helper mappers
function mapTaskTemplate(row: any): TaskTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    taskType: row.task_type,
    applicableRoles: row.applicable_roles || [],
    tasks: row.tasks || [],
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTaskCompletion(row: any): TaskCompletion {
  return {
    id: row.id,
    templateId: row.template_id,
    staffId: row.staff_id,
    shiftId: row.shift_id,
    completionDate: row.completion_date,
    completedTasks: row.completed_tasks || [],
    isFullyCompleted: row.is_fully_completed,
    completionPercentage: row.completion_percentage,
    notes: row.notes,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
