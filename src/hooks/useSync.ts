import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface SyncLog {
  id: string;
  syncType: 'google_sheets' | 'google_reviews' | 'manual';
  status: 'pending' | 'running' | 'completed' | 'failed';
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  metadata: Record<string, unknown> | null;
}

export interface SyncSheetsParams {
  sheetId: string;
  sheetName?: string;
  startRow?: number;
  endRow?: number;
}

export interface SyncResult {
  success: boolean;
  processed?: number;
  created?: number;
  updated?: number;
  errors?: string[];
  error?: string;
}

// Hook to fetch sync logs
export function useSyncLogs() {
  return useQuery({
    queryKey: ['sync-logs'],
    queryFn: async (): Promise<SyncLog[]> => {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return (data || []).map((row) => ({
        id: row.id,
        syncType: row.sync_type,
        status: row.status,
        recordsProcessed: row.records_processed,
        recordsCreated: row.records_created,
        recordsUpdated: row.records_updated,
        errorMessage: row.error_message,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        metadata: row.metadata,
      }));
    },
  });
}

// Hook to trigger Google Sheets sync
export function useSyncSheets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SyncSheetsParams): Promise<SyncResult> => {
      console.log('Starting sync with params:', params);
      
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      try {
        // Try direct fetch to bypass any Supabase client issues
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const functionUrl = `${supabaseUrl}/functions/v1/bright-service`;
        
        console.log('Calling function at:', functionUrl);

        const { data: { session } } = await supabase.auth.getSession();
        const bearer = session?.access_token || supabaseAnonKey;
        
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(supabaseAnonKey ? { apikey: supabaseAnonKey } : {}),
            ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          },
          signal: controller.signal,
          body: JSON.stringify(params),
        });
        
        console.log('Response status:', response.status);
        
        const data = await response.json().catch(() => null);
        const error = response.ok ? null : { message: (data as any)?.error || 'Request failed' };

        clearTimeout(timeoutId);
        
        console.log('Sync response:', { data, error });

        if (error) {
          console.error('Sync error:', error);
          throw new Error(error.message || 'Edge function returned an error');
        }

        if (!data) {
          throw new Error('No response from Edge Function. Check if the function is deployed correctly.');
        }

        return data as SyncResult;
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error('Sync timed out after 60 seconds. The function may not be responding.');
        }
        throw err;
      }
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['kpi-summary'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-sales'] });
    },
  });
}

// Extract Sheet ID from various Google Sheets URL formats
export function extractSheetId(url: string): string | null {
  // Format 1: https://docs.google.com/spreadsheets/d/SHEET_ID/...
  const match1 = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match1) return match1[1];

  // Format 2: https://docs.google.com/spreadsheets/d/e/SHEET_ID/...
  const match2 = url.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
  if (match2) return match2[1];

  // If it's already just the ID
  if (/^[a-zA-Z0-9-_]+$/.test(url)) {
    return url;
  }

  return null;
}
