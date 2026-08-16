import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const html = await readFile(join(process.cwd(), "public", "tpao-teklif.html"), "utf-8");
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
