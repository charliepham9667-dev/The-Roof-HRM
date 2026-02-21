import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUCKET = 'task-checklist-photos'
const RETENTION_DAYS = 7
const BATCH_SIZE = 100

Deno.serve(async (req) => {
  // Allow manual invocation only via POST (or cron trigger)
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('Missing environment variables', { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)

  let totalDeleted = 0
  let cursor: string | undefined = undefined

  try {
    // List all files at the root level (staff_id folders)
    const { data: staffFolders, error: folderErr } = await supabase.storage
      .from(BUCKET)
      .list('', { limit: 200 })

    if (folderErr) throw folderErr

    const staffIds = (staffFolders || [])
      .filter((item) => !item.metadata) // folders have no metadata
      .map((f) => f.name)

    const toDelete: string[] = []

    // Walk: staff_id / date / template_id / task_slug / files
    for (const staffId of staffIds) {
      const { data: dateFolders } = await supabase.storage
        .from(BUCKET)
        .list(staffId, { limit: 200 })

      for (const dateFolder of dateFolders || []) {
        if (dateFolder.metadata) continue // skip files
        const datePath = `${staffId}/${dateFolder.name}`

        // Check if date is older than retention window
        const folderDate = new Date(dateFolder.name)
        if (!isNaN(folderDate.getTime()) && folderDate < cutoff) {
          // Recursively collect all files under this date folder
          const paths = await listAllFiles(supabase, BUCKET, datePath)
          toDelete.push(...paths)
        }
      }
    }

    // Delete in batches
    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
      const batch = toDelete.slice(i, i + BATCH_SIZE)
      const { error: delErr } = await supabase.storage.from(BUCKET).remove(batch)
      if (delErr) console.error('Batch delete error:', delErr.message)
      else totalDeleted += batch.length
    }

    console.log(`Cleanup complete. Deleted ${totalDeleted} files older than ${RETENTION_DAYS} days.`)
    return new Response(
      JSON.stringify({ deleted: totalDeleted, cutoff: cutoff.toISOString() }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Cleanup error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})

async function listAllFiles(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const paths: string[] = []
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error || !data) return paths

  for (const item of data) {
    const itemPath = `${prefix}/${item.name}`
    if (item.metadata) {
      // It's a file
      paths.push(itemPath)
    } else {
      // It's a folder — recurse
      const nested = await listAllFiles(supabase, bucket, itemPath)
      paths.push(...nested)
    }
  }

  return paths
}

/*
To schedule this function with pg_cron (run once daily at 3am):

  SELECT cron.schedule(
    'cleanup-task-photos-daily',
    '0 3 * * *',
    $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/cleanup-task-photos',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    )
    $$
  );
*/
