import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { LeaveRequest, LeaveType, LeaveStatus, CreateLeaveRequestInput } from '../types';

// Get current user's leave requests
export function useMyLeaveRequests() {
  const profile = useAuthStore((s) => s.profile);

  return useQuery({
    queryKey: ['leave-requests', 'mine', profile?.id],
    queryFn: async (): Promise<LeaveRequest[]> => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          reviewer:reviewed_by (full_name, email)
        `)
        .eq('staff_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...mapLeaveRequest(row),
        reviewer: row.reviewer ? {
          id: row.reviewed_by,
          fullName: row.reviewer.full_name,
          email: row.reviewer.email,
        } : undefined,
      }));
    },
    enabled: !!profile?.id,
  });
}

// Get all pending leave requests (for managers)
export function usePendingLeaveRequests() {
  return useQuery({
    queryKey: ['leave-requests', 'pending'],
    queryFn: async (): Promise<LeaveRequest[]> => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          staff:staff_id (full_name, email, job_role, avatar_url)
        `)
        .eq('status', 'pending')
        .order('start_date', { ascending: true });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...mapLeaveRequest(row),
        staff: row.staff ? {
          id: row.staff_id,
          fullName: row.staff.full_name,
          email: row.staff.email,
          jobRole: row.staff.job_role,
          avatarUrl: row.staff.avatar_url,
        } : undefined,
      }));
    },
  });
}

// Get all leave requests for a date range (for calendar view)
export function useLeaveRequestsInRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['leave-requests', 'range', startDate, endDate],
    queryFn: async (): Promise<LeaveRequest[]> => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          staff:staff_id (full_name, email, job_role, avatar_url)
        `)
        .in('status', ['pending', 'approved'])
        .or(`start_date.lte.${endDate},end_date.gte.${startDate}`)
        .order('start_date', { ascending: true });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...mapLeaveRequest(row),
        staff: row.staff ? {
          id: row.staff_id,
          fullName: row.staff.full_name,
          email: row.staff.email,
          jobRole: row.staff.job_role,
          avatarUrl: row.staff.avatar_url,
        } : undefined,
      }));
    },
  });
}

// Create leave request
export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  return useMutation({
    mutationFn: async (input: CreateLeaveRequestInput) => {
      if (!profile?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('leave_requests')
        .insert({
          staff_id: profile.id,
          start_date: input.startDate,
          end_date: input.endDate,
          leave_type: input.leaveType,
          reason: input.reason || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    },
  });
}

// Cancel leave request (by staff)
export function useCancelLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase
        .from('leave_requests')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('status', 'pending') // Can only cancel pending requests
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    },
  });
}

// Approve/Reject leave request (by manager)
export function useReviewLeaveRequest() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  return useMutation({
    mutationFn: async ({
      requestId,
      status,
      reviewNote,
    }: {
      requestId: string;
      status: 'approved' | 'rejected';
      reviewNote?: string;
    }) => {
      if (!profile?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('leave_requests')
        .update({
          status,
          reviewed_by: profile.id,
          review_note: reviewNote || null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    },
  });
}

// Get leave balance for current user
export function useLeaveBalance() {
  const profile = useAuthStore((s) => s.profile);

  return {
    annualLeaveDays: profile?.annualLeaveDays ?? 12,
    leaveDaysUsed: profile?.leaveDaysUsed ?? 0,
    remainingDays: (profile?.annualLeaveDays ?? 12) - (profile?.leaveDaysUsed ?? 0),
  };
}

// Helper mapper
function mapLeaveRequest(row: any): LeaveRequest {
  return {
    id: row.id,
    staffId: row.staff_id,
    startDate: row.start_date,
    endDate: row.end_date,
    totalDays: row.total_days,
    reason: row.reason,
    leaveType: row.leave_type as LeaveType,
    status: row.status as LeaveStatus,
    reviewedBy: row.reviewed_by,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
