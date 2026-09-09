/**
 * OTP delivery over fast2sms (DLT route).
 *
 * When FAST2SMS_API_KEY is unset (local dev before env wiring) the code is
 * logged to the server console instead of sent, so the gate flow stays
 * testable. In that mode `sendOtpSms` resolves without throwing.
 *
 * Template/sender are the values from the client's DLT registration and can
 * be overridden by env without a code change.
 */

const FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2";
const SENDER_ID = process.env.FAST2SMS_SENDER_ID || "TACHIN";
const DLT_TEMPLATE = process.env.FAST2SMS_DLT_TEMPLATE || "190690";

export async function sendOtpSms(phone: string, otp: string): Promise<void> {
  const apiKey = process.env.FAST2SMS_API_KEY;

  if (!apiKey) {
    console.log(
      `[gate] FAST2SMS_API_KEY unset — OTP for ${phone} is ${otp} (not sent)`
    );
    return;
  }

  const res = await fetch(FAST2SMS_URL, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      route: "dlt",
      sender_id: SENDER_ID,
      message: DLT_TEMPLATE,
      variables_values: `${otp}|`,
      flash: 0,
      numbers: phone,
    }),
  });

  const text = await res.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }

  const ok =
    res.ok &&
    typeof payload === "object" &&
    payload !== null &&
    (payload as { return?: boolean }).return === true;

  if (!ok) {
    console.error("[gate] fast2sms send failed:", res.status, payload);
    throw new Error("SMS send failed");
  }
}
