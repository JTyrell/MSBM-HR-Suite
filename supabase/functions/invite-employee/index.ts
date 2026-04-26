/* eslint-disable @typescript-eslint/no-explicit-any */
 
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * invite-employee â€” Supabase Edge Function
 *
 * Creates a new employee user (admin/HR only), generates a random temp password,
 * and returns a password-reset link so the employee can set their own credentials
 * on first login.
 */

function getAllowedOrigin(): string {
  return Deno.env.get("ALLOWED_ORIGIN") || Deno.env.get("SUPABASE_URL") || "*";
}

function corsHeaders(origin?: string | null): Record<string, string> {
  const allowed = getAllowedOrigin();
  return {
    "Access-Control-Allow-Origin": allowed === "*" ? "*" : (origin || allowed),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function generateTempPassword(length = 20): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    // â”€â”€ 1. Authenticate caller â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { headers: { ...headers, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller identity
    const supabaseCaller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await supabaseCaller.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { headers: { ...headers, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // â”€â”€ 2. Verify caller is admin or HR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const roles = (callerRoles || []).map((r: Record<string, any>) => r.role);
    if (!roles.includes("admin") && !roles.includes("hr_manager")) {
      return new Response(
        JSON.stringify({ error: "Only admins and HR managers can invite employees" }),
        { headers: { ...headers, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // â”€â”€ 3. Parse and validate body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const body = await req.json();
    const { email, first_name, last_name, department_id, job_title, pay_rate, pay_type } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "A valid email address is required" }),
        { headers: { ...headers, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!first_name || !last_name) {
      return new Response(
        JSON.stringify({ error: "First and last name are required" }),
        { headers: { ...headers, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // â”€â”€ 4. Create user with temp password â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const tempPassword = generateTempPassword();

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: tempPassword,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        first_name: first_name.trim(),
        last_name: last_name.trim(),
      },
    });

    if (createError) {
      const message = createError.message.includes("already been registered")
        ? "An account with this email already exists"
        : createError.message;
      return new Response(
        JSON.stringify({ error: message }),
        { headers: { ...headers, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // â”€â”€ 5. Update profile with extra fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // The handle_new_user trigger already created the profile + default role.
    // Now update with the additional fields from the invite form.
    if (newUser?.user) {
      const updates: Record<string, any> = {};
      if (department_id) updates.department_id = department_id;
      if (job_title) updates.job_title = job_title.trim();
      if (pay_rate !== undefined && pay_rate !== null) updates.pay_rate = Math.max(0, Number(pay_rate) || 0);
      if (pay_type === "hourly" || pay_type === "salary") updates.pay_type = pay_type;

      if (Object.keys(updates).length > 0) {
        await supabaseAdmin
          .from("profiles")
          .update(updates)
          .eq("user_id", newUser.user.id);
      }
    }

    // â”€â”€ 6. Generate password reset link â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // This link allows the employee to set their own password on first visit.
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email.trim().toLowerCase(),
      options: {
        redirectTo: `${Deno.env.get("SITE_URL") || supabaseUrl}/auth`,
      },
    });

    const resetLink = linkData?.properties?.action_link || null;

    // â”€â”€ 7. Audit log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: caller.id,
      action: "employee_invited",
      entity_type: "profile",
      entity_id: newUser?.user?.id || null,
      details: {
        email,
        first_name,
        last_name,
        invited_by: caller.email,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Employee ${first_name} ${last_name} invited successfully`,
        user_id: newUser?.user?.id,
        reset_link: resetLink,
      }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const headers2 = corsHeaders(req.headers.get("origin"));
    console.error("[invite-employee] Error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { headers: { ...headers2, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
