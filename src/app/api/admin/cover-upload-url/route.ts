export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { coverS3Key, getUploadUrl, cdnPublicUrl } from "@/lib/s3";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) return auth.response;

  const ext = req.nextUrl.searchParams.get("ext") || "jpg";
  const uid = randomUUID();
  const key = coverS3Key(uid, ext);
  const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const uploadUrl = await getUploadUrl(key, contentType);

  return NextResponse.json({ uploadUrl, key, cdnUrl: cdnPublicUrl(key) });
}
