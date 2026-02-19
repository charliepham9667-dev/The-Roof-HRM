import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { calculateDistance, getCurrentPosition } from '../lib/geofence';
import type { ClockRecord, VenueSettings } from '../types';

// Get venue settings (for geofence)
export function useVenueSettings() {
  return useQuery({
    queryKey: ['venue-settings'],
    queryFn: async (): Promise<VenueSettings | null> => {
      const { data, error } = await supabase
        .from('venue_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) {
        console.error('Failed to fetch venue settings:', error);
        return null;
      }

      return {
        id: data.id,
        venueName: data.venue_name,
        address: data.address,
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        geofenceRadiusMeters: data.geofence_radius_meters,
        timezone: data.timezone,
        operatingHours: data.operating_hours,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

// Get today's clock records for current user
export function useTodayClockRecords() {
  const profile = useAuthStore((s) => s.profile);
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['clock-records', 'today', profile?.id],
    queryFn: async (): Promise<ClockRecord[]> => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from('clock_records')
        .select('*')
        .eq('staff_id', profile.id)
        .gte('clock_time', `${today}T00:00:00`)
        .lt('clock_time', `${today}T23:59:59`)
        .order('clock_time', { ascending: true });

      if (error) throw error;

      return (data || []).map(mapClockRecord);
    },
    enabled: !!profile?.id,
    refetchInterval: 30000, // Refresh every 30s
  });
}

// Get clock records for a date range (for managers)
export function useClockRecords(startDate: string, endDate: string, staffId?: string) {
  return useQuery({
    queryKey: ['clock-records', startDate, endDate, staffId],
    queryFn: async (): Promise<ClockRecord[]> => {
      let query = supabase
        .from('clock_records')
        .select(`
          *,
          profiles:staff_id (full_name, email)
        `)
        .gte('clock_time', `${startDate}T00:00:00`)
        .lte('clock_time', `${endDate}T23:59:59`)
        .order('clock_time', { ascending: false });

      if (staffId) {
        query = query.eq('staff_id', staffId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...mapClockRecord(row),
        staff: row.profiles ? {
          id: row.staff_id,
          fullName: row.profiles.full_name,
          email: row.profiles.email,
        } : undefined,
      }));
    },
    refetchInterval: 30000, // Refresh every 30s (dashboard-friendly realtime)
  });
}

// Clock in mutation
export function useClockIn() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  return useMutation({
    mutationFn: async ({ shiftId }: { shiftId?: string } = {}) => {
      if (!profile?.id) throw new Error('Not authenticated');

      // Get current location
      let latitude: number | undefined;
      let longitude: number | undefined;
      let isWithinGeofence = false;
      let distanceFromVenue: number | undefined;

      try {
        const position = await getCurrentPosition();
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;

        // Get venue settings to check geofence
        const { data: venue } = await supabase
          .from('venue_settings')
          .select('latitude, longitude, geofence_radius_meters')
          .limit(1)
          .single();

        if (venue) {
          distanceFromVenue = calculateDistance(
            { latitude: latitude!, longitude: longitude! },
            { latitude: parseFloat(venue.latitude), longitude: parseFloat(venue.longitude) }
          );
          isWithinGeofence = distanceFromVenue <= venue.geofence_radius_meters;
        }
      } catch (err) {
        console.warn('Could not get location:', err);
      }

      const { data, error } = await supabase
        .from('clock_records')
        .insert({
          staff_id: profile.id,
          shift_id: shiftId || null,
          clock_type: 'in',
          clock_time: new Date().toISOString(),
          latitude,
          longitude,
          is_within_geofence: isWithinGeofence,
          distance_from_venue: distanceFromVenue,
          device_info: navigator.userAgent,
        })
        .select()
        .single();

      if (error) throw error;

      // If there's a shift, update its status
      if (shiftId) {
        await supabase
          .from('shifts')
          .update({ status: 'in_progress', clock_in: new Date().toISOString() })
          .eq('id', shiftId);
      }

      return { ...data, isWithinGeofence, distanceFromVenue };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clock-records'] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['staffing'] });
    },
  });
}

// Clock out mutation
export function useClockOut() {
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);

  return useMutation({
    mutationFn: async ({ shiftId }: { shiftId?: string } = {}) => {
      if (!profile?.id) throw new Error('Not authenticated');

      // Get current location
      let latitude: number | undefined;
      let longitude: number | undefined;
      let isWithinGeofence = false;
      let distanceFromVenue: number | undefined;

      try {
        const position = await getCurrentPosition();
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;

        const { data: venue } = await supabase
          .from('venue_settings')
          .select('latitude, longitude, geofence_radius_meters')
          .limit(1)
          .single();

        if (venue) {
          distanceFromVenue = calculateDistance(
            { latitude: latitude!, longitude: longitude! },
            { latitude: parseFloat(venue.latitude), longitude: parseFloat(venue.longitude) }
          );
          isWithinGeofence = distanceFromVenue <= venue.geofence_radius_meters;
        }
      } catch (err) {
        console.warn('Could not get location:', err);
      }

      const { data, error } = await supabase
        .from('clock_records')
        .insert({
          staff_id: profile.id,
          shift_id: shiftId || null,
          clock_type: 'out',
          clock_time: new Date().toISOString(),
          latitude,
          longitude,
          is_within_geofence: isWithinGeofence,
          distance_from_venue: distanceFromVenue,
          device_info: navigator.userAgent,
        })
        .select()
        .single();

      if (error) throw error;

      // If there's a shift, update its status
      if (shiftId) {
        await supabase
          .from('shifts')
          .update({ status: 'completed', clock_out: new Date().toISOString() })
          .eq('id', shiftId);
      }

      return { ...data, isWithinGeofence, distanceFromVenue };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clock-records'] });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      queryClient.invalidateQueries({ queryKey: ['staffing'] });
    },
  });
}

// Get current clock status (are we clocked in?)
export function useClockStatus() {
  const { data: todayRecords, isLoading } = useTodayClockRecords();

  const lastRecord = todayRecords?.[todayRecords.length - 1];
  const isClockedIn = lastRecord?.clockType === 'in';
  const lastClockIn = todayRecords?.filter(r => r.clockType === 'in').pop();
  const lastClockOut = todayRecords?.filter(r => r.clockType === 'out').pop();

  return {
    isLoading,
    isClockedIn,
    lastClockIn,
    lastClockOut,
    todayRecords,
  };
}

export interface DailyAttendance {
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMinutes: number;
  totalMinutes: number;
  overtimeMinutes: number;
  isWithinGeofence: boolean;
}

export function useMyAttendanceHistory(daysBack: number = 90) {
  const profile = useAuthStore((s) => s.profile);
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  return useQuery({
    queryKey: ['attendance-history', profile?.id, daysBack],
    queryFn: async (): Promise<DailyAttendance[]> => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from('clock_records')
        .select('*')
        .eq('staff_id', profile.id)
        .gte('clock_time', `${startDate}T00:00:00`)
        .lte('clock_time', `${endDate}T23:59:59`)
        .order('clock_time', { ascending: true });

      if (error) throw error;

      const records: ClockRecord[] = (data || []).map(mapClockRecord);

      // Group records by date
      const byDate = new Map<string, ClockRecord[]>();
      for (const r of records) {
        const date = r.clockTime.split('T')[0];
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date)!.push(r);
      }

      const result: DailyAttendance[] = [];

      for (const [date, dayRecords] of byDate.entries()) {
        const clockInRecord = dayRecords.find(r => r.clockType === 'in');
        const clockOutRecord = [...dayRecords].reverse().find(r => r.clockType === 'out');

        // Sum break durations
        let breakMinutes = 0;
        const breakStarts = dayRecords.filter(r => r.clockType === 'break_start');
        const breakEnds = dayRecords.filter(r => r.clockType === 'break_end');
        for (let i = 0; i < Math.min(breakStarts.length, breakEnds.length); i++) {
          const diff =
            new Date(breakEnds[i].clockTime).getTime() -
            new Date(breakStarts[i].clockTime).getTime();
          breakMinutes += Math.max(0, Math.floor(diff / 60000));
        }

        let totalMinutes = 0;
        if (clockInRecord && clockOutRecord) {
          const diff =
            new Date(clockOutRecord.clockTime).getTime() -
            new Date(clockInRecord.clockTime).getTime();
          totalMinutes = Math.max(0, Math.floor(diff / 60000) - breakMinutes);
        }

        const overtimeMinutes = Math.max(0, totalMinutes - 480);

        result.push({
          date,
          clockIn: clockInRecord?.clockTime ?? null,
          clockOut: clockOutRecord?.clockTime ?? null,
          breakMinutes,
          totalMinutes,
          overtimeMinutes,
          isWithinGeofence: clockInRecord?.isWithinGeofence ?? false,
        });
      }

      return result.sort((a, b) => b.date.localeCompare(a.date));
    },
    enabled: !!profile?.id,
  });
}

// Helper to map DB row to ClockRecord
function mapClockRecord(row: any): ClockRecord {
  return {
    id: row.id,
    staffId: row.staff_id,
    shiftId: row.shift_id,
    clockType: row.clock_type,
    clockTime: row.clock_time,
    latitude: row.latitude ? parseFloat(row.latitude) : undefined,
    longitude: row.longitude ? parseFloat(row.longitude) : undefined,
    isWithinGeofence: row.is_within_geofence,
    distanceFromVenue: row.distance_from_venue ? parseFloat(row.distance_from_venue) : undefined,
    deviceInfo: row.device_info,
    ipAddress: row.ip_address,
    notes: row.notes,
    overrideBy: row.override_by,
    createdAt: row.created_at,
  };
}
