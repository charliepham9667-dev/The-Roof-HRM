import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { insertNotifications } from './useNotifications';

export interface Shift {
  id: string;
  staffId: string;
  staffName?: string;
  staffEmail?: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'no_show' | 'cancelled';
  clockIn: string | null;
  clockOut: string | null;
  notes: string | null;
}

export interface CreateShiftInput {
  staffId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role: string;
  notes?: string;
}

// Get week's shifts
export function useShifts(weekDate: Date) {
  const weekStart = getWeekStart(weekDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return useQuery({
    queryKey: ['shifts', weekStart.toISOString().split('T')[0]],
    queryFn: async (): Promise<Shift[]> => {
      const { data, error } = await supabase
        .from('shifts')
        .select(`
          *,
          profiles:staff_id (
            full_name,
            email
          )
        `)
        .gte('shift_date', weekStart.toISOString().split('T')[0])
        .lte('shift_date', weekEnd.toISOString().split('T')[0])
        .order('shift_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        staffId: row.staff_id,
        staffName: row.profiles?.full_name || 'Unknown',
        staffEmail: row.profiles?.email,
        shiftDate: row.shift_date,
        startTime: row.start_time,
        endTime: row.end_time,
        role: row.role,
        status: row.status,
        clockIn: row.clock_in,
        clockOut: row.clock_out,
        notes: row.notes,
      }));
    },
  });
}

// Get single shift
export function useShift(shiftId: string | null) {
  return useQuery({
    queryKey: ['shift', shiftId],
    queryFn: async (): Promise<Shift | null> => {
      if (!shiftId) return null;

      const { data, error } = await supabase
        .from('shifts')
        .select(`
          *,
          profiles:staff_id (
            full_name,
            email
          )
        `)
        .eq('id', shiftId)
        .single();

      if (error) throw error;

      return {
        id: data.id,
        staffId: data.staff_id,
        staffName: data.profiles?.full_name || 'Unknown',
        staffEmail: data.profiles?.email,
        shiftDate: data.shift_date,
        startTime: data.start_time,
        endTime: data.end_time,
        role: data.role,
        status: data.status,
        clockIn: data.clock_in,
        clockOut: data.clock_out,
        notes: data.notes,
      };
    },
    enabled: !!shiftId,
  });
}

// Create shift
export function useCreateShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateShiftInput) => {
      const { data, error } = await supabase
        .from('shifts')
        .insert({
          staff_id: input.staffId,
          shift_date: input.shiftDate,
          start_time: input.startTime,
          end_time: input.endTime,
          role: input.role,
          notes: input.notes || null,
          status: 'scheduled',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
  });
}

// Update shift
export function useUpdateShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateShiftInput> & { id: string }) => {
      const updateData: any = {};
      if (input.staffId) updateData.staff_id = input.staffId;
      if (input.shiftDate) updateData.shift_date = input.shiftDate;
      if (input.startTime) updateData.start_time = input.startTime;
      if (input.endTime) updateData.end_time = input.endTime;
      if (input.role) updateData.role = input.role;
      if (input.notes !== undefined) updateData.notes = input.notes;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('shifts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['shift'] });
    },
  });
}

// Delete shift
export function useDeleteShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
  });
}

// Clock in/out
export function useClockInOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ shiftId, action }: { shiftId: string; action: 'in' | 'out' }) => {
      const now = new Date().toISOString();
      const updateData = action === 'in'
        ? { clock_in: now, status: 'in_progress' }
        : { clock_out: now, status: 'completed' };

      const { data, error } = await supabase
        .from('shifts')
        .update(updateData)
        .eq('id', shiftId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['staffing'] });
    },
  });
}

// Get today's shifts
export function useTodayShifts(todayIso: string) {
  return useQuery({
    queryKey: ['shifts-today', todayIso],
    queryFn: async (): Promise<Shift[]> => {
      const { data, error } = await supabase
        .from('shifts')
        .select(`
          *,
          profiles:staff_id (
            full_name,
            email,
            job_role,
            department
          )
        `)
        .eq('shift_date', todayIso)
        .not('status', 'eq', 'cancelled')
        .order('start_time', { ascending: true });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        staffId: row.staff_id,
        staffName: row.profiles?.full_name || 'Unknown',
        staffEmail: row.profiles?.email,
        jobRole: row.profiles?.job_role || row.role || '',
        department: row.profiles?.department || '',
        shiftDate: row.shift_date,
        startTime: row.start_time,
        endTime: row.end_time,
        role: row.role,
        status: row.status,
        clockIn: row.clock_in,
        clockOut: row.clock_out,
        notes: row.notes,
      }));
    },
    enabled: Boolean(todayIso),
    staleTime: 1000 * 60 * 5,
  });
}

// Get all staff for dropdown (only active)
export function useStaffList() {
  return useQuery({
    queryKey: ['staff-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, full_name, email, role, phone, hire_date, avatar_url, job_role, employment_type, manager_type, department, reports_to'
        )
        .eq('is_active', true)
        .eq('status', 'active')
        .order('full_name');

      if (error) throw error;
      return data || [];
    },
  });
}

// Fetch profiles awaiting owner approval
export function usePendingProfiles() {
  return useQuery({
    queryKey: ['pending-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, created_at, role')
        .eq('status', 'pending')
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
  });
}

// Check for upcoming shifts within 24 hours and create a reminder notification
// if one has not been sent yet for the shift. Safe to call on every app load.
export function useUpcomingShiftReminder() {
  const profile = useAuthStore((s) => s.profile);

  return useQuery({
    queryKey: ['upcoming-shift-reminder', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const todayIso = now.toISOString().split('T')[0];
      const tomorrowIso = in24h.toISOString().split('T')[0];

      const { data: shifts, error: shiftsError } = await supabase
        .from('shifts')
        .select('id, shift_date, start_time, end_time, role')
        .eq('staff_id', profile.id)
        .in('shift_date', [todayIso, tomorrowIso])
        .eq('status', 'scheduled')
        .order('shift_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(3);

      if (shiftsError || !shifts || shifts.length === 0) return null;

      const { data: existing } = await supabase
        .from('notifications')
        .select('related_id')
        .eq('user_id', profile.id)
        .eq('notification_type', 'shift_reminder')
        .in('related_id', shifts.map((s) => s.id));

      const notifiedIds = new Set((existing || []).map((n: any) => n.related_id));
      const unnotified = shifts.filter((s) => !notifiedIds.has(s.id));

      if (unnotified.length === 0) return null;

      await insertNotifications(
        unnotified.map((shift) => {
          const isToday = shift.shift_date === todayIso;
          return {
            userId: profile.id,
            title: `${isToday ? 'Today' : 'Tomorrow'}'s shift: ${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)}`,
            body: `You have a ${shift.role} shift scheduled`,
            notificationType: 'shift_reminder' as const,
            relatedType: 'shift',
            relatedId: shift.id,
          };
        })
      );

      return unnotified.length;
    },
    enabled: !!profile?.id,
    staleTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  });
}

// Helper
function getWeekStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}
