export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { kullaniciAktiflestirKoltukKontrollu } from "@/lib/seats";

export async function PATCH(req: NextRequest) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const { userId, action } = await req.json();
  if (!userId || !action) {
    return NextResponse.json({ error: "Eksik parametre." }, { status: 400 });
  }
  if (userId === user.id) {
    return NextResponse.json({ error: "Kendinizi değiştiremezsiniz." }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, companyId: user.companyId! },
    select: { id: true, isActive: true },
  });

  if (!target) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  if (action === "toggle_active") {
    // Pasif → aktif geçişi koltuk kullanır; davet akışıyla aynı kota kontrolünden geçer.
    if (!target.isActive) {
      try {
        await kullaniciAktiflestirKoltukKontrollu(user.companyId!, userId, { isActive: true });
      } catch (e: unknown) {
        const code = (e as { code?: string } | null)?.code;
        if (code === "SEATS_FULL" && e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
        if (code === "NOT_FOUND") return NextResponse.json({ error: "Şirket bulunamadı." }, { status: 404 });
        throw e;
      }
      return NextResponse.json({ ok: true, isActive: true });
    }
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
    return NextResponse.json({ ok: true, isActive: false });
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
