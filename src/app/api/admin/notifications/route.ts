export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { sendToAll, sendToCompany, sendToUsers, countActiveTokens } from "@/lib/push";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  // Gönderim geçmişi
  if (action === "history") {
    const logs = await prisma.notificationLog.findMany({
      orderBy: { sentAt: "desc" },
      take: 20,
      include: { admin: { select: { name: true, email: true } } },
    });
    return NextResponse.json(logs);
  }

  // Şirket başına aktif token sayısı
  if (action === "company-counts") {
    const companies = await prisma.company.findMany({
      where: { isActive: true, endDate: { gt: new Date() } },
      select: {
        id: true,
        name: true,
        users: {
          where: { isActive: true, pushToken: { not: null } },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(
      companies.map((c) => ({ id: c.id, name: c.name, count: c.users.length }))
    );
  }

  // Gönderim öncesi alıcı sayısı (onay adımı)
  const target = (searchParams.get("target") as "all" | "company") ?? "all";
  const companyId = searchParams.get("companyId") ?? undefined;
  const count = await countActiveTokens(target, companyId);
  return NextResponse.json({ count });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { title, body, data, target, companyId, userIds, coverUrl } = await req.json();

  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "Başlık ve mesaj gerekli." }, { status: 400 });
  }

  const payload = {
    title: title.trim(),
    body: body.trim(),
    data: data ?? {},
    coverUrl: coverUrl || undefined,
  };

  let result: { sent: number; failed: number };

  if (target === "company" && companyId) {
    result = await sendToCompany(companyId, payload);
  } else if (target === "users" && Array.isArray(userIds) && userIds.length > 0) {
    result = await sendToUsers(userIds, payload);
  } else {
    result = await sendToAll(payload);
  }

  // Gönderim geçmişine kaydet
  prisma.notificationLog.create({
    data: {
      adminId: session.id,
      target: target ?? "all",
      companyId: companyId ?? null,
      title: title.trim(),
      body: body.trim(),
      bookId: data?.bookId as string ?? null,
      coverUrl: coverUrl ?? null,
      sent: result.sent,
      failed: result.failed,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, ...result });
}
