export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getPlayUrl } from "@/lib/s3";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role === "SUPER_ADMIN") {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
    }

    // companyId token'dan değil, DB'den — user.isActive + company.isActive + endDate tek sorguda
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        isActive: true,
        company: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            brandColor: true,
            isActive: true,
            endDate: true,
            package: {
              select: {
                name: true,
                books: {
                  where: { book: { isActive: true } },
                  include: {
                    book: {
                      select: {
                        id: true,
                        title: true,
                        author: true,
                        narrator: true,
                        duration: true,
                        coverUrl: true,
                        description: true,
                        isActive: true,
                        category: { select: { name: true } },
                        series: { select: { id: true, name: true, slug: true } },
                        seriesOrder: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user?.isActive) {
      return NextResponse.json({ error: "Hesap pasif." }, { status: 403 });
    }

    const company = user.company;
    if (!company?.isActive) {
      return NextResponse.json({ books: [], company: null });
    }

    if (company.endDate && company.endDate < new Date()) {
      return NextResponse.json({ books: [], company: null });
    }

    const books = (company.package?.books ?? [])
      .map((pb) => pb.book)
      .filter((b): b is NonNullable<typeof b> => b != null && b.isActive === true);
    const bookIds = books.map((b) => b.id);

    const playerStates = await prisma.playerState.findMany({
      where: { userId: session.id, bookId: { in: bookIds } },
      select: { bookId: true, positionSec: true },
    });

    let userFavorites: { bookId: string }[] = [];
    try {
      userFavorites = await (prisma as any).userFavorite.findMany({
        where: { userId: session.id, bookId: { in: bookIds } },
        select: { bookId: true },
      });
    } catch {}

    const stateMap = Object.fromEntries(playerStates.map((ps) => [ps.bookId, ps]));
    const favoriteSet = new Set(userFavorites.map((f) => f.bookId));

    const booksWithProgress = books.map(({ isActive: _active, ...b }) => ({
      ...b,
      progressPct: stateMap[b.id]
        ? Math.min(100, Math.round((stateMap[b.id].positionSec / b.duration) * 100))
        : 0,
      isFavorite: favoriteSet.has(b.id),
    }));

    let logoSignedUrl: string | null = null;
    if (company.logoUrl) {
      try {
        const s3Key = company.logoUrl.replace(/^\/api\/logos\//, "logos/");
        logoSignedUrl = await getPlayUrl(s3Key);
      } catch {
        logoSignedUrl = null;
      }
    }

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        logoUrl: logoSignedUrl,
        brandColor: company.brandColor ?? null,
        endDate: company.endDate,
        packageName: company.package?.name,
      },
      books: booksWithProgress,
    });
  } catch (err: any) {
    console.error("[library] HATA:", err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? "Sunucu hatası" }, { status: 500 });
  }
}
