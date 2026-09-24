export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { sendToAll, sendToCompany, sendToUsers } from "@/lib/push";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { title, body, data, target, companyId, userIds } = await req.json();

  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "Başlık ve mesaj gerekli." }, { status: 400 });
  }

  const payload = { title: title.trim(), body: body.trim(), data: data ?? {} };

  let result: { sent: number; failed: number };

  if (target === "company" && companyId) {
    result = await sendToCompany(companyId, payload);
  } else if (target === "users" && Array.isArray(userIds) && userIds.length > 0) {
    result = await sendToUsers(userIds, payload);
  } else {
    result = await sendToAll(payload);
  }

  return NextResponse.json({ ok: true, ...result });
}
