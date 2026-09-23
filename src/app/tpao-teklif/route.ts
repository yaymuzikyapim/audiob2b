import { readFile } from "fs/promises";
import { join } from "path";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", "https://www.audiob2b.com.tr"));

  const html = await readFile(join(process.cwd(), "private", "tpao-teklif.html"), "utf-8");
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
