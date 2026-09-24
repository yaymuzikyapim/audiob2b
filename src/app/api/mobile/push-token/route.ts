export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }

    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token gerekli." }, { status: 400 });
    }

    // Aynı token başka kullanıcıda varsa önce temizle (cihaz paylaşımı / hesap değişimi)
    await prisma.user.updateMany({
      where: { pushToken: token, NOT: { id: session.id } },
      data: { pushToken: null },
    });

    await prisma.user.update({
      where: { id: session.id },
      data: { pushToken: token },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("push-token error:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}

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
    return NextResponse.json({ ok: true }); // Sessizce geç — çıkışı engelleme
  }
}
