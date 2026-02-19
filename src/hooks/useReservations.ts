import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { Reservation, CreateReservationInput, ReservationStatus } from '../types';

// Get today's reservations
export function useTodayReservations() {
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['reservations', 'today'],
    queryFn: async (): Promise<Reservation[]> => {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('reservation_date', today)
        .in('status', ['pending', 'confirmed', 'seated'])
        .order('reservation_time', { ascending: true });

      if (error) throw error;
      return (data || []).map(mapReservation);
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

// Get reservations for a date range
export function useReservations(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['reservations', startDate, endDate],
    queryFn: async (): Promise<Reservation[]> => {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .gte('reservation_date', startDate)
        .lte('reservation_date', endDate)
        .order('reservation_date', { ascending: true })
        .order('reservation_time', { ascending: true });

      if (error) throw error;
      return (data || []).map(mapReservation);
    },
  });
}

// Get single reservation
export function useReservation(reservationId: string | null) {
  return useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: async (): Promise<Reservation | null> => {
      if (!reservationId) return null;

      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      if (error) throw error;
      return mapReservation(data);
    },
    enabled: !!reservationId,
  });
}

// Create reservation
export function useCreateReservation() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  return useMutation({
    mutationFn: async (input: CreateReservationInput) => {
      // Ensure we have a valid session before attempting the insert
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please refresh the page and sign in again.');
      }

      const payload = {
        customer_name: input.customerName,
        customer_phone: input.customerPhone || null,
        customer_email: input.customerEmail || null,
        reservation_date: input.reservationDate,
        reservation_time: input.reservationTime,
        party_size: input.partySize,
        table_preference: input.tablePreference || null,
        special_requests: input.specialRequests || null,
        source: input.source || 'phone',
        notes: input.notes || null,
        status: 'confirmed',
        created_by: profile?.id || null,
      };

      console.log('[useCreateReservation] inserting payload:', payload);
      console.log('[useCreateReservation] session user:', session.user.email, 'id:', session.user.id);

      const { data, error } = await supabase
        .from('reservations')
        .insert(payload)
        .select()
        .single();

      console.log('[useCreateReservation] result:', { data: data?.id, error });

      if (error) throw new Error(error.message || JSON.stringify(error));
      return data;
    },
    onSuccess: (data) => {
      console.log('[useCreateReservation] success, id:', data?.id);
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
    onError: (error) => {
      console.error('[useCreateReservation] mutation error:', error);
    },
  });
}

// Update reservation
export function useUpdateReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<CreateReservationInput> & { id: string; status?: ReservationStatus }) => {
      const updateData: any = { updated_at: new Date().toISOString() };
      
      if (input.customerName !== undefined) updateData.customer_name = input.customerName;
      if (input.customerPhone !== undefined) updateData.customer_phone = input.customerPhone;
      if (input.customerEmail !== undefined) updateData.customer_email = input.customerEmail;
      if (input.reservationDate !== undefined) updateData.reservation_date = input.reservationDate;
      if (input.reservationTime !== undefined) updateData.reservation_time = input.reservationTime;
      if (input.partySize !== undefined) updateData.party_size = input.partySize;
      if (input.tablePreference !== undefined) updateData.table_preference = input.tablePreference;
      if (input.specialRequests !== undefined) updateData.special_requests = input.specialRequests;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const { data, error } = await supabase
        .from('reservations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservation'] });
    },
  });
}

// Update reservation status
export function useUpdateReservationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ReservationStatus }) => {
      const { data, error } = await supabase
        .from('reservations')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}

// Delete reservation
export function useDeleteReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}

// Get reservation stats for a period
export function useReservationStats(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['reservation-stats', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('status, party_size')
        .gte('reservation_date', startDate)
        .lte('reservation_date', endDate);

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        confirmed: 0,
        completed: 0,
        noShow: 0,
        cancelled: 0,
        totalGuests: 0,
      };

      (data || []).forEach((r: any) => {
        stats.totalGuests += r.party_size;
        if (r.status === 'confirmed' || r.status === 'pending') stats.confirmed++;
        else if (r.status === 'completed' || r.status === 'seated') stats.completed++;
        else if (r.status === 'no_show') stats.noShow++;
        else if (r.status === 'cancelled') stats.cancelled++;
      });

      return stats;
    },
  });
}

// Helper mapper
function mapReservation(row: any): Reservation {
  return {
    id: row.id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    reservationDate: row.reservation_date,
    reservationTime: row.reservation_time,
    partySize: row.party_size,
    tablePreference: row.table_preference,
    specialRequests: row.special_requests,
    status: row.status,
    source: row.source,
    notes: row.notes,
    reminderSent: row.reminder_sent,
    reminderSentAt: row.reminder_sent_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
