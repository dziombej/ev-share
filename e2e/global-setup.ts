import { createClient, type SupabaseClient } from "@supabase/supabase-js";

async function ensureUser(adminClient: SupabaseClient, email: string, password: string): Promise<void> {
  const { error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  const alreadyExists = error?.code === "email_exists" || error?.message.toLowerCase().includes("already");

  if (error && !alreadyExists) {
    throw error;
  }
}

export default async function globalSetup() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  const seekerEmail = process.env.E2E_SEEKER_USERNAME;
  const seekerPassword = process.env.E2E_SEEKER_PASSWORD;

  if (!supabaseUrl || !serviceRoleKey || !email || !password || !seekerEmail || !seekerPassword) {
    throw new Error(
      "Missing required env vars for e2e global-setup: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, " +
        "E2E_USERNAME, E2E_PASSWORD, E2E_SEEKER_USERNAME, E2E_SEEKER_PASSWORD (see .env.test.example).",
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  await ensureUser(adminClient, email, password);
  await ensureUser(adminClient, seekerEmail, seekerPassword);
}
