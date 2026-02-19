import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { CalendarEvent, EventType, EventChecklistItem, EventMarketingStatus } from '../types';

// Get events for a date range
export function useEvents(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['events', startDate, endDate],
    queryFn: async (): Promise<CalendarEvent[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .or(`start_date.lte.${endDate},end_date.gte.${startDate}`)
        .order('start_date', { ascending: true });

      if (error) throw error;
      return (data || []).map(mapEvent);
    },
  });
}

// Get upcoming events (next 30 days)
export function useUpcomingEvents(limit: number = 10) {
  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const endDate = futureDate.toISOString().split('T')[0];

  return useQuery({
    queryKey: ['events', 'upcoming', limit],
    queryFn: async (): Promise<CalendarEvent[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .gte('start_date', today)
        .lte('start_date', endDate)
        .order('start_date', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(mapEvent);
    },
  });
}

// Get today's event (first active event starting today)
export function useTodaysEvent() {
  const profile = useAuthStore((s) => s.profile)
  const today = new Date().toISOString().split('T')[0]

  return useQuery({
    queryKey: ['events', 'today', today],
    queryFn: async (): Promise<CalendarEvent | null> => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', today)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .order('start_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data ? mapEvent(data) : null
    },
    enabled: !!profile,
  })
}

// Get active events for a specific day (agenda-style)
export function useEventsForDate(date: string) {
  const profile = useAuthStore((s) => s.profile)

  return useQuery({
    queryKey: ['events', 'date', date],
    queryFn: async (): Promise<CalendarEvent[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', date)
        .or(`end_date.is.null,end_date.gte.${date}`)
        .order('start_date', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) throw error
      return (data || []).map(mapEvent)
    },
    enabled: !!profile,
  })
}

// Create event
export function useCreateEvent() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  return useMutation({
    mutationFn: async (input: Partial<CalendarEvent>) => {
      if (!profile?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('events')
        .insert({
          title: input.title,
          title_vi: input.titleVi || null,
          description: input.description || null,
          description_vi: input.descriptionVi || null,
          event_type: input.eventType,
          start_date: input.startDate,
          end_date: input.endDate || input.startDate,
          start_time: input.startTime || null,
          end_time: input.endTime || null,
          is_all_day: input.isAllDay || false,
          location: input.location || null,
          color: input.color || '#3b82f6',
          icon: input.icon || null,
          is_active: true,
          created_by: profile.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// Update event
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CalendarEvent> & { id: string }) => {
      const updateData: any = { updated_at: new Date().toISOString() };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.titleVi !== undefined) updateData.title_vi = input.titleVi;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.eventType !== undefined) updateData.event_type = input.eventType;
      if (input.startDate !== undefined) updateData.start_date = input.startDate;
      if (input.endDate !== undefined) updateData.end_date = input.endDate;
      if (input.startTime !== undefined) updateData.start_time = input.startTime;
      if (input.endTime !== undefined) updateData.end_time = input.endTime;
      if (input.isAllDay !== undefined) updateData.is_all_day = input.isAllDay;
      if (input.location !== undefined) updateData.location = input.location;
      if (input.color !== undefined) updateData.color = input.color;
      if (input.marketingStatus !== undefined) updateData.marketing_status = input.marketingStatus;
      if (input.checklist !== undefined) updateData.checklist = input.checklist;

      const { data, error } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// Delete event
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('events')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// Helper mapper
function mapEvent(row: any): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    titleVi: row.title_vi,
    description: row.description,
    descriptionVi: row.description_vi,
    eventType: row.event_type as EventType,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    isAllDay: row.is_all_day,
    location: row.location,
    isRecurring: row.is_recurring,
    recurrenceRule: row.recurrence_rule,
    color: row.color,
    icon: row.icon,
    relatedPromotionId: row.related_promotion_id,
    createdBy: row.created_by,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    marketingStatus: (row.marketing_status as EventMarketingStatus) ?? 'not_started',
    checklist: Array.isArray(row.checklist) ? (row.checklist as EventChecklistItem[]) : [],
  };
}
