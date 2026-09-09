import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, type WebsiteLead } from "@/lib/supabaseAdmin";
import { notifyLead } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scroll-gate step 2. Checks the 6-digit code against the row stored by
 * /api/gate/send-otp.
 *
 * On success the row is marked verified, the code is cleared, and the lead
 * is pushed to Telegram (best-effort). Response: { status: "verified" }.
 * Failures return { error } with one of: not_found | expired | locked |
 * mismatch.
 */

const MAX_ATTEMPTS = 5;

const schema = z.object({
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => /^\d{10}$/.test(v), "Enter a 10-digit mobile number"),
  otp: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => /^\d{6}$/.test(v), "Enter the 6-digit code"),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const { phone, otp } = parsed.data;

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    console.error("[gate] supabase not configured:", err);
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const { data: lead, error: selectError } = await supabase
    .from("website_leads")
    .select("*")
    .eq("phone", phone)
    .maybeSingle<WebsiteLead>();

  if (selectError) {
    console.error("[gate] select failed:", selectError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  if (!lead) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (lead.verified) {
    return NextResponse.json({ status: "verified" });
  }
  if (!lead.otp || !lead.otp_expires_at) {
    return NextResponse.json({ error: "not_found" }, { status: 400 });
  }
  if (new Date(lead.otp_expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "expired" }, { status: 400 });
  }
  if (lead.otp_attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "locked" }, { status: 429 });
  }
  if (lead.otp !== otp) {
    await supabase
      .from("website_leads")
      .update({ otp_attempts: lead.otp_attempts + 1 })
      .eq("id", lead.id);
    return NextResponse.json({ error: "mismatch" }, { status: 400 });
  }

  const verifiedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("website_leads")
    .update({
      verified: true,
      verified_at: verifiedAt,
      otp: null,
      otp_expires_at: null,
    })
    .eq("id", lead.id)
    .select("*")
    .single<WebsiteLead>();

  if (updateError) {
    console.error("[gate] verify update failed:", updateError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  await notifyLead(updated ?? { ...lead, verified: true, verified_at: verifiedAt });

  return NextResponse.json({ status: "verified" });
}
