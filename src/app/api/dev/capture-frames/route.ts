import { mkdir, writeFile } from "fs/promises";
import path from "path";

/**
 * DEV ONLY — receives the phone frame sequence from PhoneScene's capture
 * mode (?capture=phone) and writes it into public/images/phone-frames/.
 * 404 outside development; only names matching phone-NNN.webp are
 * writable, so nothing else on disk is reachable through this route.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }

  const { name, data } = (await request.json()) as {
    name?: string;
    data?: string;
  };
  if (typeof name !== "string" || !/^phone-\d{3}\.webp$/.test(name)) {
    return new Response("Bad name", { status: 400 });
  }
  if (typeof data !== "string" || !data) {
    return new Response("Bad data", { status: 400 });
  }

  const bytes = Buffer.from(data, "base64");
  const dir = path.join(process.cwd(), "public", "images", "phone-frames");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);

  return Response.json({ saved: name, bytes: bytes.length });
}
