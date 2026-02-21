import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { Notification, NotificationType } from '../types';

export interface CreateNotificationInput {
  userId: string;
  title: string;
  body?: string;
  notificationType: NotificationType;
  relatedType?: string;
  relatedId?: string;
  scheduledFor?: string;
}

// Get user's notifications
export function useNotifications(limit: number = 20) {
  const profile = useAuthStore((s) => s.profile);

  return useQuery({
    queryKey: ['notifications', profile?.id, limit],
    queryFn: async (): Promise<Notification[]> => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(mapNotification);
    },
    enabled: !!profile?.id,
  });
}

// Get unread count
export function useUnreadNotificationCount() {
  const profile = useAuthStore((s) => s.profile);

  return useQuery({
    queryKey: ['notifications', 'unread-count', profile?.id],
    queryFn: async (): Promise<number> => {
      if (!profile?.id) return 0;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!profile?.id,
    refetchInterval: 30000, // Check every 30 seconds
  });
}

// Mark notification as read
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// Create a notification (used by various triggers)
export function useCreateNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateNotificationInput) => {
      const { error } = await supabase.from('notifications').insert({
        user_id: input.userId,
        title: input.title,
        body: input.body,
        notification_type: input.notificationType,
        related_type: input.relatedType,
        related_id: input.relatedId,
        scheduled_for: input.scheduledFor,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// Create multiple notifications at once (fan-out)
export async function insertNotifications(inputs: CreateNotificationInput[]) {
  if (inputs.length === 0) return;
  const rows = inputs.map((input) => ({
    user_id: input.userId,
    title: input.title,
    body: input.body,
    notification_type: input.notificationType,
    related_type: input.relatedType,
    related_id: input.relatedId,
    scheduled_for: input.scheduledFor,
    created_at: new Date().toISOString(),
  }));
  await supabase.from('notifications').insert(rows);
}

// Mark all as read
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  return useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('user_id', profile.id)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// Helper mapper
function mapNotification(row: any): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    titleVi: row.title_vi,
    body: row.body,
    bodyVi: row.body_vi,
    notificationType: row.notification_type,
    relatedType: row.related_type,
    relatedId: row.related_id,
    isRead: row.is_read,
    readAt: row.read_at,
    isSent: row.is_sent,
    sentAt: row.sent_at,
    scheduledFor: row.scheduled_for,
    createdAt: row.created_at,
  };
}
