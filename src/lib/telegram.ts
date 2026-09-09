import type { WebsiteLead } from "./supabaseAdmin";

/**
 * Posts a completed (OTP-verified) lead to the Telegram channel.
 *
 * Best-effort only: any failure here — missing env, network, Telegram API
 * error — is logged and swallowed so it can never fail the verify request.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function notifyLead(lead: WebsiteLead): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log("[gate] Telegram not configured — skipping lead notification");
    return;
  }

  const when = new Date(lead.verified_at ?? Date.now()).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const text =
    `<b>New website lead</b>\n` +
    `Name: ${escapeHtml(lead.name)}\n` +
    `Phone: <code>+91${escapeHtml(lead.phone)}</code>\n` +
    `Verified: ${escapeHtml(when)} IST`;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );
    if (!res.ok) {
      console.error(
        "[gate] Telegram sendMessage failed:",
        res.status,
        await res.text()
      );
    }
  } catch (err) {
    console.error("[gate] Telegram notification error:", err);
  }
}
