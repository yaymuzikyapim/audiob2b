export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "COMPANY_ADMIN" || !session.companyId) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { userId, action } = await req.json();
  if (!userId || !action) {
    return NextResponse.json({ error: "Eksik parametre." }, { status: 400 });
  }
  if (userId === session.id) {
    return NextResponse.json({ error: "Kendinizi değiştiremezsiniz." }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, companyId: session.companyId },
    select: { id: true, isActive: true },
  });

  if (!target) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  if (action === "toggle_active") {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: !target.isActive },
    });
    return NextResponse.json({ ok: true, isActive: !target.isActive });
  }

  if (action === "remove") {
    await prisma.user.update({
      where: { id: userId },
      data: { companyId: null, isActive: false },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
}
