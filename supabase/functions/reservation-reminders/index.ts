import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Format "17:00:00" → "17:00"
function fmtTime(t: string | null): string {
  if (!t) return '';
  return t.slice(0, 5);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Optional shared secret for extra security when called from external cron
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (cronSecret) {
      const authHeader = req.headers.get('x-cron-secret') ?? '';
      if (authHeader !== cronSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Get reservations whose time falls within the next 60 minutes
    //    and haven't been reminded yet
    const { data: reservations, error: resErr } = await supabase
      .rpc('get_reservations_for_reminder', { hours_ahead: 1 });

    if (resErr) throw resErr;

    if (!reservations || reservations.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No reservations need reminders right now.' }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch all owner + manager profile IDs
    const { data: recipients, error: profErr } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['owner', 'manager']);

    if (profErr) throw profErr;
    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No owner/manager recipients found.' }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const recipientIds: string[] = recipients.map((r: { id: string }) => r.id);

    let processed = 0;

    for (const res of reservations) {
      const timeLabel   = fmtTime(res.reservation_time);
      const title       = `Reservation reminder: ${res.customer_name}, ${res.party_size} pax at ${timeLabel}`;
      const bodyParts: string[] = [`Tonight at ${timeLabel}`];
      if (res.table_preference) bodyParts.push(`Table: ${res.table_preference}`);
      if (res.special_requests) bodyParts.push(res.special_requests.slice(0, 60));
      const body = bodyParts.join(' · ');

      // 3a. Insert in-app notifications for all owners + managers
      const notifRows = recipientIds.map((uid: string) => ({
        user_id: uid,
        title,
        body,
        notification_type: 'reservation_reminder',
        related_type: 'reservation',
        related_id: res.id,
        created_at: new Date().toISOString(),
      }));

      const { error: notifErr } = await supabase
        .from('notifications')
        .insert(notifRows);

      if (notifErr) {
        console.warn(`[reservation-reminders] notifications insert failed for ${res.id}:`, notifErr.message);
      }

      // 3b. Send Web Push to subscribed devices
      const { error: pushErr } = await supabase.functions.invoke('send-push', {
        body: {
          user_ids: recipientIds,
          title,
          body,
          url: '/reservations',
        },
      });

      if (pushErr) {
        console.warn(`[reservation-reminders] send-push failed for ${res.id}:`, pushErr.message);
      }

      // 4. Mark reservation as reminded so it never fires twice
      const { error: updateErr } = await supabase
        .from('reservations')
        .update({
          reminder_sent: true,
          reminder_sent_at: new Date().toISOString(),
        })
        .eq('id', res.id);

      if (updateErr) {
        console.warn(`[reservation-reminders] could not mark reminder_sent for ${res.id}:`, updateErr.message);
      } else {
        processed++;
      }
    }

    return new Response(
      JSON.stringify({
        processed,
        total: reservations.length,
        recipients: recipientIds.length,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[reservation-reminders] error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
