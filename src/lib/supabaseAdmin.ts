import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client, built from the service-role key so it
 * bypasses RLS. Never import this into a client component — the key must
 * never reach the browser.
 *
 * `website_leads` has RLS enabled with no policies, so this is the only
 * credential that can read or write it.
 */

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Shape of one row in public.website_leads. */
export type WebsiteLead = {
  id: string;
  name: string;
  phone: string;
  otp: string | null;
  otp_expires_at: string | null;
  otp_attempts: number;
  verified: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};
