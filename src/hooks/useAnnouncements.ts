import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { Announcement, AnnouncementReply, CreateAnnouncementInput } from '../types';

// Get all active announcements
export function useAnnouncements() {
  const profile = useAuthStore((s) => s.profile);

  return useQuery({
    queryKey: ['announcements'],
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          author:author_id (full_name, email, avatar_url),
          announcement_reads (user_id),
          announcement_replies (id)
        `)
        .eq('is_active', true)
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...mapAnnouncement(row),
        author: row.author ? {
          id: row.author_id,
          fullName: row.author.full_name,
          email: row.author.email,
          avatarUrl: row.author.avatar_url,
        } : undefined,
        readCount: row.announcement_reads?.length || 0,
        replyCount: row.announcement_replies?.length || 0,
        isRead: row.announcement_reads?.some((r: any) => r.user_id === profile?.id) || false,
      }));
    },
  });
}

// Get single announcement with replies
export function useAnnouncement(announcementId: string | null) {
  const profile = useAuthStore((s) => s.profile);

  return useQuery({
    queryKey: ['announcement', announcementId],
    queryFn: async (): Promise<Announcement | null> => {
      if (!announcementId) return null;

      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          author:author_id (full_name, email, avatar_url),
          announcement_reads (user_id)
        `)
        .eq('id', announcementId)
        .single();

      if (error) throw error;

      return {
        ...mapAnnouncement(data),
        author: data.author ? {
          id: data.author_id,
          fullName: data.author.full_name,
          email: data.author.email,
          avatarUrl: data.author.avatar_url,
        } : undefined,
        readCount: data.announcement_reads?.length || 0,
        isRead: data.announcement_reads?.some((r: any) => r.user_id === profile?.id) || false,
      };
    },
    enabled: !!announcementId,
  });
}

// Get replies for an announcement
export function useAnnouncementReplies(announcementId: string | null) {
  return useQuery({
    queryKey: ['announcement-replies', announcementId],
    queryFn: async (): Promise<AnnouncementReply[]> => {
      if (!announcementId) return [];

      const { data, error } = await supabase
        .from('announcement_replies')
        .select(`
          *,
          author:author_id (full_name, email, avatar_url)
        `)
        .eq('announcement_id', announcementId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...mapAnnouncementReply(row),
        author: row.author ? {
          id: row.author_id,
          fullName: row.author.full_name,
          email: row.author.email,
          avatarUrl: row.author.avatar_url,
        } : undefined,
      }));
    },
    enabled: !!announcementId,
  });
}

// Create announcement (manager/owner)
export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  return useMutation({
    mutationFn: async (input: CreateAnnouncementInput) => {
      if (!profile?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('announcements')
        .insert({
          title: input.title,
          body: input.body,
          author_id: profile.id,
          audience: input.audience || 'all',
          is_pinned: input.isPinned || false,
          allow_replies: input.allowReplies ?? true,
          image_url: input.imageUrl || null,
          is_active: true,
          published_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}

// Update announcement
export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<CreateAnnouncementInput> & { id: string }) => {
      const updateData: any = { updated_at: new Date().toISOString() };
      if (input.title !== undefined) updateData.title = input.title;
      if (input.body !== undefined) updateData.body = input.body;
      if (input.audience !== undefined) updateData.audience = input.audience;
      if (input.isPinned !== undefined) updateData.is_pinned = input.isPinned;
      if (input.allowReplies !== undefined) updateData.allow_replies = input.allowReplies;
      if (input.imageUrl !== undefined) updateData.image_url = input.imageUrl;

      const { data, error } = await supabase
        .from('announcements')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcement'] });
    },
  });
}

// Delete (soft) announcement
export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('announcements')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}

// Mark announcement as read
export function useMarkAnnouncementRead() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  return useMutation({
    mutationFn: async (announcementId: string) => {
      if (!profile?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('announcement_reads')
        .upsert({
          announcement_id: announcementId,
          user_id: profile.id,
          read_at: new Date().toISOString(),
        }, {
          onConflict: 'announcement_id,user_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcement'] });
    },
  });
}

// Create reply
export function useCreateAnnouncementReply() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  return useMutation({
    mutationFn: async ({
      announcementId,
      body,
      parentReplyId,
    }: {
      announcementId: string;
      body: string;
      parentReplyId?: string;
    }) => {
      if (!profile?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('announcement_replies')
        .insert({
          announcement_id: announcementId,
          author_id: profile.id,
          body,
          parent_reply_id: parentReplyId || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['announcement-replies', variables.announcementId] });
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}

// Helper mappers
function mapAnnouncement(row: any): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    imageUrl: row.image_url,
    authorId: row.author_id,
    audience: row.audience,
    isPinned: row.is_pinned,
    isActive: row.is_active,
    allowReplies: row.allow_replies,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAnnouncementReply(row: any): AnnouncementReply {
  return {
    id: row.id,
    announcementId: row.announcement_id,
    authorId: row.author_id,
    parentReplyId: row.parent_reply_id,
    body: row.body,
    isEdited: row.is_edited,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
