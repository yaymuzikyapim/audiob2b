export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getPlayUrl } from "@/lib/s3";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const s3Key = `covers/${key.join("/")}`;
  const signedUrl = await getPlayUrl(s3Key);
  return NextResponse.redirect(signedUrl, {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
