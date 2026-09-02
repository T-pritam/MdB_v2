import { mkdir, writeFile } from "fs/promises";
import path from "path";

/**
 * DEV ONLY — receives stills from /dev/capture and writes them into
 * public/images/story/. Deleted together with the capture page.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not available", { status: 404 });
  }

  const name = new URL(request.url).searchParams.get("name") ?? "";
  if (!/^story-beat-[1-4]\.png$/.test(name)) {
    return new Response("Bad name", { status: 400 });
  }

  const bytes = Buffer.from(await request.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "images", "story");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);

  return Response.json({ saved: name, bytes: bytes.length });
}
