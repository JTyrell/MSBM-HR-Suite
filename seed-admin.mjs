/**
 * seed-admin.mjs — One-time script to create a demo admin user
 *
 * Usage:
 *   node seed-admin.mjs
 *
 * Before running, set SUPABASE_SERVICE_ROLE_KEY in your .env or pass it:
 *   $env:SUPABASE_SERVICE_ROLE_KEY="your-key-here"; node seed-admin.mjs
 *
 * Find your service role key at:
 *   https://supabase.com/dashboard → Project → Settings → API → service_role (secret)
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config(); // loads .env

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing env vars. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  console.error("   Grab the service_role key from: Supabase Dashboard → Settings → API");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Demo Admin Account ────────────────────────────────────────
const ADMIN_EMAIL = "admin@msbm.edu.jm";
const ADMIN_PASSWORD = "Admin@MSBM2026!";
const ADMIN_FIRST = "System";
const ADMIN_LAST = "Administrator";

async function main() {
  console.log("🔧 Creating demo admin user...\n");

  // 1. Create the auth user
  const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      first_name: ADMIN_FIRST,
      last_name: ADMIN_LAST,
    },
  });

  if (createErr) {
    if (createErr.message.includes("already been registered")) {
      console.log("ℹ️  User already exists. Fetching existing user...");

      // Look up by email
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const existing = users?.find((u) => u.email === ADMIN_EMAIL);
      if (!existing) {
        console.error("❌ Could not find existing user");
        process.exit(1);
      }
      console.log(`   Found user: ${existing.id}`);

      // Ensure admin role
      await ensureAdminRole(existing.id);
      await updateProfile(existing.id);
      printSuccess(existing.id);
      return;
    }
    console.error("❌ Failed to create user:", createErr.message);
    process.exit(1);
  }

  const userId = newUser.user.id;
  console.log(`✅ Auth user created: ${userId}`);

  // 2. Wait briefly for the handle_new_user trigger to fire
  console.log("⏳ Waiting for database trigger...");
  await new Promise((r) => setTimeout(r, 2000));

  // 3. Update profile
  await updateProfile(userId);

  // 4. Add admin role
  await ensureAdminRole(userId);

  printSuccess(userId);
}

async function updateProfile(userId) {
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: ADMIN_FIRST,
      last_name: ADMIN_LAST,
      job_title: "System Administrator",
      status: "active",
      role_tier: "executive",
    })
    .eq("user_id", userId);

  if (error) {
    console.warn("⚠️  Profile update warning:", error.message);
  } else {
    console.log("✅ Profile updated");
  }
}

async function ensureAdminRole(userId) {
  // Check if admin role already exists
  const { data: existing } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin");

  if (existing && existing.length > 0) {
    console.log("✅ Admin role already assigned");
    return;
  }

  const { error } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role: "admin" });

  if (error) {
    console.error("❌ Failed to assign admin role:", error.message);
  } else {
    console.log("✅ Admin role assigned");
  }
}

function printSuccess(userId) {
  console.log("\n" + "═".repeat(52));
  console.log("  🎉  DEMO ADMIN ACCOUNT READY");
  console.log("═".repeat(52));
  console.log(`  Email:     ${ADMIN_EMAIL}`);
  console.log(`  Password:  ${ADMIN_PASSWORD}`);
  console.log(`  User ID:   ${userId}`);
  console.log(`  Role:      admin`);
  console.log("═".repeat(52));
  console.log("\n  Log in at your app and use this account to");
  console.log("  invite other employees and assign roles.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
