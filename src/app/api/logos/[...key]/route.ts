export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getPlayUrl } from "@/lib/s3";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const s3Key = `logos/${key.join("/")}`;

  const signedUrl = await getPlayUrl(s3Key);
  const s3Res = await fetch(signedUrl);

  if (!s3Res.ok) {
    return NextResponse.json({ error: "Logo bulunamadı." }, { status: 404 });
  }

  const contentType = s3Res.headers.get("content-type") || "image/png";
  const buffer = await s3Res.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
