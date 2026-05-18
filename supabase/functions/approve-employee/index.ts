import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Server misconfigured." }, 500);
    }

    // Verify caller identity
    const token = getBearerToken(req);
    if (!token) {
      return json({ error: "Missing Authorization bearer token." }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } =
      await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      return json({ error: "Invalid JWT." }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Permission check – only owners can approve
    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (callerError || !callerProfile) {
      return json({ error: "Caller profile not found." }, 403);
    }
    if (!["owner", "manager"].includes(String(callerProfile.role))) {
      return json({ error: "Forbidden – only owners/managers can approve staff." }, 403);
    }

    // Parse body
    const body = await req.json();
    const profileId = String(body.profileId || "").trim();
    const action = String(body.action || "approve");
    if (!profileId) {
      return json({ error: "Missing profileId." }, 400);
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (action === "update-profile") {
      // General-purpose profile field update (bypasses RLS for owner/manager)
      const ALLOWED_FIELDS = [
        "full_name", "email", "phone", "hire_date", "job_role", "department",
        "employment_type", "manager_type", "reports_to", "is_active",
        "date_of_birth", "address", "emergency_contact_name",
        "emergency_contact_phone", "role",
        "contract_signed", "contract_signed_date", "contract_start_date",
        "contract_end_date", "contract_type",
      ];
      const fields = body.fields as Record<string, unknown> | undefined;
      if (!fields || typeof fields !== "object") {
        return json({ error: "Missing fields object for update-profile action." }, 400);
      }
      for (const key of Object.keys(fields)) {
        if (!ALLOWED_FIELDS.includes(key)) {
          return json({ error: `Field '${key}' is not allowed.` }, 400);
        }
        patch[key] = fields[key];
      }
    } else if (action === "set-reports-to") {
      // reportsTo may be null (top-level) or a valid profile UUID
      patch.reports_to = body.reportsTo ?? null;
    } else if (action === "reject") {
      patch.status = "rejected";
      patch.is_active = false;
    } else if (action === "remove") {
      patch.is_active = false;
      patch.status = "rejected";
    } else {
      // approve
      patch.status = "active";
      patch.is_active = true;
      if (body.role) patch.role = body.role;
      if (body.jobRole !== undefined) patch.job_role = body.jobRole || null;
      if (body.employmentType) patch.employment_type = body.employmentType;
      if (body.department !== undefined) patch.department = body.department || null;
      if (body.hireDate !== undefined) patch.hire_date = body.hireDate || null;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("id", profileId)
      .select("id, full_name, email, role, status, is_active")
      .single();

    if (updateError) {
      return json({ error: updateError.message }, 500);
    }

    return json({ success: true, profile: updated });
  } catch (err) {
    return json({ error: (err as Error).message || "Unexpected error" }, 500);
  }
});
