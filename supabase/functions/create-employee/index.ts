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

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeUuidOrNull(value: unknown): string | null {
  const v = String(value || "").trim();
  if (!v) return null;
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  ) {
    return v;
  }
  return null;
}

function normalizeIsoDateOrNull(value: unknown): string | null {
  const v = String(value || "").trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

type CreateEmployeeBody = {
  full_name: string;
  email: string;
  role: "owner" | "manager" | "staff";
  phone?: string | null;
  hire_date?: string | null;
  job_role?: string | null;
  employment_type?: "full_time" | "part_time" | "casual" | null;
  manager_type?: "bar" | "floor" | "marketing" | null;
  department?: string | null;
  reports_to?: string | null;
};

async function findAuthUserByEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
): Promise<{ user: { id: string; email?: string | null } | null; error?: string }> {
  // Supabase admin API doesn't support direct email lookup; page through users.
  // Bounded to avoid timeouts on larger projects.
  const perPage = 1000;
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) return { user: null, error: error.message };
    const users = data?.users ?? [];
    const found = users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (found) return { user: { id: found.id, email: found.email }, error: undefined };
    if (users.length < perPage) break;
  }
  return { user: null, error: undefined };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // ── env ──────────────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json(
        { error: "Server misconfigured – missing SUPABASE_URL or SERVICE_ROLE_KEY." },
        500,
      );
    }

    // ── authenticate caller ─────────────────────────────────────────
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
      const payload = decodeJwtPayload(token);
      const role = payload?.role as string | undefined;
      const iss = payload?.iss as string | undefined;
      return json(
        {
          error: "Invalid JWT",
          debug: {
            hint:
              role === "anon"
                ? "The anon key was sent as Authorization – this endpoint needs a signed-in user token."
                : "Ensure you are logged in and the client sends Authorization: Bearer <access_token>.",
            tokenRole: role,
            tokenIss: iss,
          },
        },
        401,
      );
    }

    // ── admin client (service role – bypasses RLS) ──────────────────
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── permission check ────────────────────────────────────────────
    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (callerError || !callerProfile) {
      return json({ error: "Caller profile not found." }, 403);
    }
    if (!["owner", "manager"].includes(String(callerProfile.role))) {
      return json(
        { error: "Forbidden – only owners and managers can add employees." },
        403,
      );
    }

    // ── parse & validate body ───────────────────────────────────────
    const body = (await req.json()) as Partial<CreateEmployeeBody>;
    const full_name = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const role = body.role as CreateEmployeeBody["role"];

    if (!full_name || !email || !role) {
      return json({ error: "Missing required fields (full_name, email, role)." }, 400);
    }
    if (!isValidEmail(email)) {
      return json({ error: "Invalid email format." }, 400);
    }
    if (!["owner", "manager", "staff"].includes(role)) {
      return json({ error: "Invalid role – must be owner, manager, or staff." }, 400);
    }

    // ── check if email already exists (profiles OR auth) ────────────
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile?.id) {
      return json({ error: "An employee with this email already exists." }, 409);
    }

    // ── create auth user ────────────────────────────────────────────
    // Using admin.createUser() instead of inviteUserByEmail() because:
    //   1. Better error messages (inviteUserByEmail wraps DB errors opaquely)
    //   2. More control over the user state
    //   3. The handle_new_user trigger creates the initial profile row
    let newUserId: string;

    const { data: createData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name, role },
      });

    if (createError) {
      const msg = createError.message || "Unknown error";

      // Supabase can return opaque errors like:
      //   "Database error creating new user"
      // even when the email already exists or a previous attempt partially succeeded.
      // Always try to locate an existing auth user and reuse it.
      const { user: existingAuthUser, error: listErr } =
        await findAuthUserByEmail(supabaseAdmin, email);

      if (existingAuthUser?.id) {
        newUserId = existingAuthUser.id;
      } else {
        return json(
          {
            error: `Failed to create auth user: ${msg}`,
            debug: {
              hint:
                "If this persists, the auth.users INSERT is being rolled back by a database trigger (commonly handle_new_user). Ensure you've applied the trigger fix migration (011) or updated handle_new_user in the SQL Editor.",
              listUsersError: listErr,
            },
          },
          500,
        );
      }
    } else {
      if (!createData?.user) {
        return json({ error: "Auth user creation returned no user." }, 500);
      }
      newUserId = createData.user.id;
    }

    // ── upsert profile with full details ────────────────────────────
    // The trigger may have already created a basic row, so we upsert.
    const profileData = {
      id: newUserId,
      email,
      full_name,
      role,
      phone: body.phone?.trim() || null,
      hire_date: normalizeIsoDateOrNull(body.hire_date),
      job_role: body.job_role?.trim() || null,
      employment_type: body.employment_type || null,
      manager_type: body.manager_type || null,
      department: body.department?.trim() || null,
      reports_to: normalizeUuidOrNull(body.reports_to),
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(profileData, { onConflict: "id" })
      .select(
        "id, email, full_name, role, phone, hire_date, avatar_url, job_role, employment_type, manager_type, department, reports_to, is_active",
      )
      .single();

    if (profileError || !profile) {
      // Best-effort rollback: delete the auth user we just created
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
      return json(
        {
          error: profileError?.message || "Failed to save employee profile.",
          debug: {
            hint: "The profile upsert failed. Check database constraints.",
            code: profileError?.code,
            details: profileError?.details,
          },
        },
        500,
      );
    }

    return json({ success: true, profile });
  } catch (err) {
    const message = (err as Error)?.message || "Unexpected server error";
    return json({ error: message }, 500);
  }
});
