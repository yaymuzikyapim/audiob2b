export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { getUploadUrl, logoS3Key, cdnPublicUrl } from "@/lib/s3";
import { randomUUID } from "crypto";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const EXT_MAP: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function GET(req: NextRequest) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const contentType = req.nextUrl.searchParams.get("contentType") || "image/png";
  if (!ALLOWED.includes(contentType)) {
    return NextResponse.json({ error: "Desteklenmeyen dosya türü." }, { status: 400 });
  }

  const ext = EXT_MAP[contentType] ?? "png";
  const uid = randomUUID();
  const key = logoS3Key(uid, ext);
  const uploadUrl = await getUploadUrl(key, contentType);

  return NextResponse.json({ uploadUrl, key, cdnUrl: cdnPublicUrl(key) });
}
