export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { requireUser } from "@/lib/auth-guard";
import { getPlayUrl } from "@/lib/s3";

export async function GET() {
  try {
    const auth = await requireUser({ roles: ["COMPANY_ADMIN", "EMPLOYEE"] });
    if (!auth.ok) return auth.response;
    const { user } = auth;
    const companyId = user.companyId!;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        brandColor: true,
        endDate: true,
        package: {
          select: {
            name: true,
            books: {
              // Bölümü olmayan kitap dinlenemez, listede de görünmesin.
              where: { book: { isActive: true, chapters: { some: {} } } },
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
    });

    if (!company) {
      return NextResponse.json({ error: "Şirket bulunamadı." }, { status: 403 });
    }

    const books = (company.package?.books ?? [])
      .map((pb) => pb.book)
      .filter((b): b is NonNullable<typeof b> => b != null && b.isActive === true);
    const bookIds = books.map((b) => b.id);

    const playerStates = await prisma.playerState.findMany({
      where: { userId: user.id, bookId: { in: bookIds } },
      select: { bookId: true, positionSec: true },
    });

    let userFavorites: { bookId: string }[] = [];
    try {
      userFavorites = await (prisma as any).userFavorite.findMany({
        where: { userId: user.id, bookId: { in: bookIds } },
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

    return NextResponse.json(
      {
        company: {
          id: company.id,
          name: company.name,
          logoUrl: logoSignedUrl,
          brandColor: company.brandColor ?? null,
          endDate: company.endDate,
          packageName: company.package?.name,
        },
        books: booksWithProgress,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err: any) {
    console.error("[library] HATA:", err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? "Sunucu hatası" }, { status: 500 });
  }
}
