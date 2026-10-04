export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    // requireActiveCompany: false — login anında şirket durumundan bağımsız çalışmalı
    const auth = await requireUser({ requireActiveCompany: false });
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token gerekli." }, { status: 400 });
    }

    // Aynı token başka kullanıcıda varsa önce temizle (cihaz paylaşımı / hesap değişimi)
    await prisma.user.updateMany({
      where: { pushToken: token, NOT: { id: user.id } },
      data: { pushToken: null },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { pushToken: token },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("push-token error:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}

// DELETE: çıkış akışının parçası — token geçersiz veya hesap pasife alınmış olsa bile
// push token temizlenebilmeli; sert hata döndürme.
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: true });
    await prisma.user.update({
      where: { id: session.id },
      data: { pushToken: null },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
