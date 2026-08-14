export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUploadUrl, logoS3Key } from "@/lib/s3";
import { randomUUID } from "crypto";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const EXT_MAP: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const contentType = req.nextUrl.searchParams.get("contentType") || "image/png";
  if (!ALLOWED.includes(contentType)) {
    return NextResponse.json({ error: "Desteklenmeyen dosya türü." }, { status: 400 });
  }

  const ext = EXT_MAP[contentType] ?? "png";
  const uid = randomUUID();
  const key = logoS3Key(uid, ext);
  const uploadUrl = await getUploadUrl(key, contentType);

  return NextResponse.json({ uploadUrl, key });
}
