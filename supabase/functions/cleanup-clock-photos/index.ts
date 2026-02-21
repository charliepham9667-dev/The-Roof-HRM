/**
 * cleanup-clock-photos
 *
 * Deletes clock-in-photos older than 90 days from Supabase Storage.
 * Invoke via a pg_cron job or the Supabase dashboard scheduler (daily).
 *
 * Example pg_cron schedule (add to a migration or run manually):
 *   select cron.schedule(
 *     'cleanup-clock-photos-daily',
 *     '0 3 * * *',   -- 03:00 UTC daily
 *     $$
 *       select net.http_post(
 *         url := current_setting('app.supabase_url') || '/functions/v1/cleanup-clock-photos',
 *         headers := jsonb_build_object(
 *           'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
 *           'Content-Type', 'application/json'
 *         ),
 *         body := '{}'::jsonb
 *       );
 *     $$
 *   );
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUCKET = 'clock-in-photos'
const RETENTION_DAYS = 90
const BATCH_SIZE = 100

Deno.serve(async (req) => {
  // Only allow POST requests (from cron or manual trigger)
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing environment variables' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
  let totalDeleted = 0
  let offset = 0

  while (true) {
    // List files in batches
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET)
      .list('', {
        limit: BATCH_SIZE,
        offset,
        sortBy: { column: 'created_at', order: 'asc' },
      })

    if (listError) {
      console.error('Error listing files:', listError.message)
      break
    }

    if (!files || files.length === 0) break

    // Filter files older than retention cutoff
    const toDelete = files
      .filter((f) => f.created_at && new Date(f.created_at) < cutoff)
      .map((f) => f.name)

    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase.storage
        .from(BUCKET)
        .remove(toDelete)

      if (deleteError) {
        console.error('Error deleting files:', deleteError.message)
      } else {
        totalDeleted += toDelete.length
        console.log(`Deleted ${toDelete.length} files`)
      }
    }

    // If we got fewer files than batch size, we're at the end
    if (files.length < BATCH_SIZE) break

    // If all files in this batch were older than cutoff, advance offset
    // Otherwise we're done (remaining files are newer)
    if (toDelete.length < files.length) break

    offset += BATCH_SIZE
  }

  return new Response(
    JSON.stringify({
      success: true,
      deleted: totalDeleted,
      retentionDays: RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
