import { NextResponse } from "next/server";
import { z } from "zod";

const leadSchema = z
  .object({
    fullName: z.string().min(2),
    contact: z.string().min(1),
    contactType: z.enum(["email", "phone"]),
    slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    slotTime: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .superRefine((data, ctx) => {
    if (data.contactType === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contact"],
          message: "Not a valid email address",
        });
      }
    } else {
      const digits = data.contact.replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 15) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contact"],
          message: "Not a valid phone number",
        });
      }
    }
  });

/**
 * Lead capture. Forwards to the dashboard endpoint when LEAD_ENDPOINT is
 * configured (Open Decision 6); until then, enquiries land in the server log
 * so nothing is silently lost during review.
 *
 * Outgoing payload (what the Build Gym admin app receives at LEAD_ENDPOINT):
 *   {
 *     fullName:    string,
 *     contact:     string,             // the email address or phone number
 *     contactType: "email" | "phone",  // which one `contact` is
 *     slotDate:    "YYYY-MM-DD",
 *     slotTime:    "HH:MM"
 *   }
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const endpoint = process.env.LEAD_ENDPOINT;
  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) throw new Error(`Dashboard responded ${res.status}`);
    } catch (err) {
      console.error("Lead forward failed:", err, parsed.data);
      return NextResponse.json({ success: false }, { status: 502 });
    }
  } else {
    console.log("New visit enquiry (no LEAD_ENDPOINT set):", parsed.data);
  }

  return NextResponse.json({ success: true });
}
