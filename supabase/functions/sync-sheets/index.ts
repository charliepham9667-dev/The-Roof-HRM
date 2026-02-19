// Supabase Edge Function: sync-sheets
// Syncs P&L data from Google Sheets to daily_metrics table

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SheetRow {
  date: string;         // DD.MM.YYYY format
  dayRevenue: number;
  nightRevenue: number;
  totalRevenue: number;
  pax: number;
  avgSpend: number;
}

// Parse European date format (DD.MM.YYYY) to ISO date
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Handle DD.MM.YYYY format
  const parts = dateStr.split(".");
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  
  return null;
}

// Parse number, handling Vietnamese/European formatting
function parseNumber(value: string | number): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  
  // Remove currency symbols, spaces, and handle comma/dot separators
  const cleaned = value.toString()
    .replace(/[đ₫VND\s]/gi, "")
    .replace(/,/g, ""); // Remove thousand separators
  
  return parseFloat(cleaned) || 0;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get request body
    const { sheetId, sheetName, startRow, endRow } = await req.json();
    
    // Validate inputs
    if (!sheetId) {
      throw new Error("sheetId is required");
    }

    // Get Google API key from environment
    const googleApiKey = Deno.env.get("GOOGLE_API_KEY");
    if (!googleApiKey) {
      throw new Error("GOOGLE_API_KEY not configured");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create sync log entry
    const { data: syncLog, error: logError } = await supabase
      .from("sync_logs")
      .insert({
        sync_type: "google_sheets",
        status: "running",
        metadata: { sheetId, sheetName, startRow, endRow },
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to create sync log:", logError);
    }

    // Fetch data from Google Sheets
    // Reading from A:W to capture all relevant columns
    // Structure varies: daily rows have date in A, KW rows have "KW X" in A
    const range = sheetName 
      ? `${sheetName}!A${startRow || 17}:W${endRow || 500}`
      : `Pnl 2026!A17:W500`;
    
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${googleApiKey}`;
    
    console.log("Fetching from Google Sheets...");
    const sheetsResponse = await fetch(sheetsUrl);
    
    if (!sheetsResponse.ok) {
      const errorText = await sheetsResponse.text();
      throw new Error(`Google Sheets API error: ${errorText}`);
    }

    const sheetsData = await sheetsResponse.json();
    const rows = sheetsData.values || [];
    
    console.log(`Found ${rows.length} rows`);

    // Process rows
    let processed = 0;
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        // Column A (index 0) contains either:
        // - A date (DD.MM.YYYY) for daily data rows
        // - "KW X" for weekly summary rows (skip these)
        // - Month names like "Jan", "Feb" (skip these)
        const colA = (row[0] || "").toString().trim();
        
        // Skip KW rows (weekly summaries)
        if (colA.startsWith("KW") || colA.match(/^[A-Za-z]{3,}$/)) {
          continue;
        }
        
        // Try to parse as date
        const date = parseDate(colA);
        
        // Skip rows without valid date
        if (!date) {
          continue;
        }

        // Column mapping (0-indexed from column A):
        // A (0): Date
        // B (1): Day of week
        // C (2): Day Revenue in USD (skip)
        // D (3): Total Revenue in VND
        // E (4): Sometimes same as D, or breakdown
        // ...
        // N (13): Pax
        // O (14): Cumulative Google reviews
        // P (15): Google Stars
        // Q (16): VND/Pax (Average Spend)
        const totalRevenue = parseNumber(row[3] || row[4] || 0);
        const pax = parseInt(row[13] || "0") || 0;
        const avgSpend = parseNumber(row[16] || 0);
        
        // Day/Night split not clearly available in sheet, use 0
        const dayRevenue = 0;
        const nightRevenue = 0;

        // Skip rows with no revenue data
        if (totalRevenue === 0 && pax === 0) {
          continue;
        }

        // Upsert to database
        const { error } = await supabase.rpc("upsert_daily_metric", {
          p_date: date,
          p_revenue: Math.round(totalRevenue),
          p_day_revenue: Math.round(dayRevenue),
          p_night_revenue: Math.round(nightRevenue),
          p_pax: pax,
          p_avg_spend: Math.round(avgSpend),
        });

        if (error) {
          errors.push(`Row ${date}: ${error.message}`);
        } else {
          processed++;
          // We can't easily tell if it was created or updated, so just count as processed
          created++;
        }
      } catch (rowError) {
        errors.push(`Row error: ${rowError.message}`);
      }
    }

    // Update sync log
    if (syncLog) {
      await supabase
        .from("sync_logs")
        .update({
          status: errors.length > 0 ? "completed" : "completed",
          records_processed: processed,
          records_created: created,
          records_updated: updated,
          error_message: errors.length > 0 ? errors.join("; ") : null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLog.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        created,
        updated,
        errors: errors.slice(0, 10), // Return first 10 errors only
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Sync error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
