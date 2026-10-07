export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signSession, SESSION_COOKIE } from "@/lib/session";
import { RATE_LIMIT } from "@/lib/rate-limit";

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "E-posta ve şifre gerekli." }, { status: 400 });
    }

    const ip = getIp(req);

    // Mevcut penceredeki başarısız deneme sayısını oku (artırmaz)
    const peek = await RATE_LIMIT.peekLoginFailures(email, ip);
    if (!peek.allowed) {
      return NextResponse.json(
        { error: "Çok fazla başarısız giriş denemesi. 15 dakika sonra tekrar deneyin." },
        { status: 429 },
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.password || !user.isActive) {
      // Başarısız deneme: sayacı artır
      await RATE_LIMIT.recordLoginFailure(email, ip);
      return NextResponse.json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      // Başarısız deneme: sayacı artır
      await RATE_LIMIT.recordLoginFailure(email, ip);
      return NextResponse.json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await signSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    });

    const response = NextResponse.json({ ok: true, role: user.role });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
