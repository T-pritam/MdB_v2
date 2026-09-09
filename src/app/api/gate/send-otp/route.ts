import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { z } from "zod";
import { getSupabaseAdmin, type WebsiteLead } from "@/lib/supabaseAdmin";
import { sendOtpSms } from "@/lib/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scroll-gate step 1. Takes the visitor's name + 10-digit mobile.
 *
 *  - Phone already verified in website_leads  → { status: "verified" }
 *    (client skips the OTP pane and unlocks straight away).
 *  - Otherwise a fresh 6-digit code is generated, stored on the row
 *    (insert or update, keyed by phone), and sent over SMS →
 *    { status: "sent" }.
 */

const OTP_TTL_MS = 10 * 60 * 1000;

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => /^\d{10}$/.test(v), "Enter a 10-digit mobile number"),
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
  const { name, phone } = parsed.data;

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    console.error("[gate] supabase not configured:", err);
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const { data: existing, error: selectError } = await supabase
    .from("website_leads")
    .select("*")
    .eq("phone", phone)
    .maybeSingle<WebsiteLead>();

  if (selectError) {
    console.error("[gate] select failed:", selectError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // Already verified — no OTP, just keep the name fresh.
  if (existing?.verified) {
    if (existing.name !== name) {
      await supabase
        .from("website_leads")
        .update({ name })
        .eq("id", existing.id);
    }
    return NextResponse.json({ status: "verified" });
  }

  const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const row = {
    name,
    phone,
    otp,
    otp_expires_at: otpExpiresAt,
    otp_attempts: 0,
    verified: false,
  };

  const { error: upsertError } = await supabase
    .from("website_leads")
    .upsert(row, { onConflict: "phone" });

  if (upsertError) {
    console.error("[gate] upsert failed:", upsertError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  try {
    await sendOtpSms(phone, otp);
  } catch (err) {
    console.error("[gate] SMS send failed:", err);
    return NextResponse.json({ error: "sms_failed" }, { status: 502 });
  }

  return NextResponse.json({ status: "sent" });
}
