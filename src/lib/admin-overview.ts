import { prisma } from "./prisma";
import { TZ_OFFSET_MS, istanbulMidnightUTC } from "./tz-utils";

// ── Yardımcı: Istanbul bugünü ────────────────────────────────────────────────

function todayIstanbul(now: Date): Date {
  const ist = new Date(now.getTime() + TZ_OFFSET_MS);
  return istanbulMidnightUTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
}

// ── Dönüş tipleri ────────────────────────────────────────────────────────────

export type RecentCompany = {
  id: string;
  name: string;
  isActive: boolean;
  endDate: Date;
  maxSeats: number;
  activeSeats: number;
  pendingSeats: number;
};

export type OverviewWarnings = {
  expiredLicenseActive: { id: string; name: string; endDate: Date }[];
  expiringSoon: { id: string; name: string; endDate: Date }[];
  expiringSoonCount: number;
  seatsFull: { id: string; name: string; ratio: number }[];
  demoCount: number;
  invitesPending: {
    total: number;
    expired: number;
    topCompanies: { id: string; name: string; count: number }[];
  };
  missingAudioCount: number;
};

export type AdminOverviewData = {
  bookStats: { total: number; listenable: number; missingAudio: number; passive: number };
  companyStats: { total: number; active: number };
  packageStats: { total: number; usedCount: number };
  userStats: { total: number; active: number };
  recentCompanies: RecentCompany[];
  todayMidnightUTC: Date;
  in30DaysUTC: Date;
  warnings: OverviewWarnings;
};

// ── Ana veri fonksiyonu ──────────────────────────────────────────────────────

export async function getAdminOverviewData(): Promise<AdminOverviewData> {
  const now = new Date();
  const todayMidnightUTC = todayIstanbul(now);
  const in30DaysUTC = new Date(todayMidnightUTC.getTime() + 30 * 86400 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400 * 1000);

  const [
    bookTotal,
    bookListenable,
    bookMissingAudio,
    bookPassive,
    companyTotal,
    packageTotal,
    packageUsedCount,
    userTotal,
    userActive,
    allCompanies,
    usersByCompany,
    pendingInvitesByCompany,
    demoCount,
    oldPendingTotal,
    oldExpiredCount,
    oldPendingByCompany,
  ] = await Promise.all([
    // Kitap sayıları
    prisma.book.count(),
    prisma.book.count({ where: { isActive: true, chapters: { some: {} } } }),
    prisma.book.count({ where: { isActive: true, chapters: { none: {} } } }),
    prisma.book.count({ where: { isActive: false } }),
    // Şirket / paket / kullanıcı
    prisma.company.count(),
    prisma.package.count(),
    prisma.package.count({ where: { companies: { some: {} } } }),
    prisma.user.count({ where: { role: { not: "SUPER_ADMIN" } } }),
    prisma.user.count({ where: { role: { not: "SUPER_ADMIN" }, isActive: true, companyId: { not: null } } }),
    // Tüm şirketler (uyarılar + tablo için)
    prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, isActive: true, endDate: true, maxSeats: true },
    }),
    // Koltuk kullanımı — aktif kullanıcı sayısı şirkete göre
    prisma.user.groupBy({
      by: ["companyId"],
      where: { isActive: true, companyId: { not: null } },
      _count: { id: true },
    }),
    // Bekleyen davet (süresi dolmamış)
    prisma.inviteToken.groupBy({
      by: ["companyId"],
      where: { usedAt: null, expiresAt: { gt: now } },
      _count: { id: true },
    }),
    // Demo talepleri (son 7 gün)
    prisma.demoRequest.count({ where: { createdAt: { gt: sevenDaysAgo } } }),
    // 7 günden eski bekleyen davetler
    prisma.inviteToken.count({ where: { usedAt: null, createdAt: { lt: sevenDaysAgo } } }),
    prisma.inviteToken.count({ where: { usedAt: null, createdAt: { lt: sevenDaysAgo }, expiresAt: { lt: now } } }),
    prisma.inviteToken.groupBy({
      by: ["companyId"],
      where: { usedAt: null, createdAt: { lt: sevenDaysAgo } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 3,
    }),
  ]);

  // Koltuk haritaları
  const activeByCompany = new Map(
    usersByCompany.map((g) => [g.companyId as string, g._count.id]),
  );
  const pendingByCompany = new Map(
    pendingInvitesByCompany.map((g) => [g.companyId, g._count.id]),
  );

  // Aktif şirket: isActive && endDate >= bugün (Istanbul günü)
  const activeCompanyCount = allCompanies.filter(
    (c) => c.isActive && c.endDate >= todayMidnightUTC,
  ).length;

  // Uyarılar
  const expiredLicenseActive = allCompanies.filter(
    (c) => c.isActive && c.endDate < todayMidnightUTC,
  );

  const expiringSoonAll = allCompanies
    .filter((c) => c.endDate >= todayMidnightUTC && c.endDate < in30DaysUTC)
    .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());

  const seatsFull = allCompanies
    .filter((c) => {
      const active = activeByCompany.get(c.id) ?? 0;
      const pending = pendingByCompany.get(c.id) ?? 0;
      return c.maxSeats > 0 && (active + pending) / c.maxSeats >= 0.9;
    })
    .map((c) => {
      const active = activeByCompany.get(c.id) ?? 0;
      const pending = pendingByCompany.get(c.id) ?? 0;
      return { id: c.id, name: c.name, ratio: (active + pending) / c.maxSeats };
    });

  // Top 3 şirket (eski bekleyen davet)
  const topOldPendingCompanies = oldPendingByCompany.map((g) => {
    const company = allCompanies.find((c) => c.id === g.companyId);
    return { id: g.companyId, name: company?.name ?? "Bilinmiyor", count: g._count.id };
  });

  // Son 5 şirket (tablo)
  const recentCompanies: RecentCompany[] = allCompanies.slice(0, 5).map((c) => ({
    ...c,
    activeSeats: activeByCompany.get(c.id) ?? 0,
    pendingSeats: pendingByCompany.get(c.id) ?? 0,
  }));

  return {
    bookStats: { total: bookTotal, listenable: bookListenable, missingAudio: bookMissingAudio, passive: bookPassive },
    companyStats: { total: companyTotal, active: activeCompanyCount },
    packageStats: { total: packageTotal, usedCount: packageUsedCount },
    userStats: { total: userTotal, active: userActive },
    recentCompanies,
    todayMidnightUTC,
    in30DaysUTC,
    warnings: {
      expiredLicenseActive,
      expiringSoon: expiringSoonAll.slice(0, 3),
      expiringSoonCount: expiringSoonAll.length,
      seatsFull,
      demoCount,
      invitesPending: {
        total: oldPendingTotal,
        expired: oldExpiredCount,
        topCompanies: topOldPendingCompanies,
      },
      missingAudioCount: bookMissingAudio,
    },
  };
}

// ── Şirketler sayfası için koltuk kullanım haritası ──────────────────────────

export async function getCompanySeatMap(companyIds: string[], now: Date) {
  const [activeUsers, pendingInvites] = await Promise.all([
    prisma.user.groupBy({
      by: ["companyId"],
      where: { isActive: true, companyId: { in: companyIds } },
      _count: { id: true },
    }),
    prisma.inviteToken.groupBy({
      by: ["companyId"],
      where: { usedAt: null, expiresAt: { gt: now }, companyId: { in: companyIds } },
      _count: { id: true },
    }),
  ]);

  const activeMap = new Map(activeUsers.map((g) => [g.companyId as string, g._count.id]));
  const pendingMap = new Map(pendingInvites.map((g) => [g.companyId, g._count.id]));

  return { activeMap, pendingMap };
}
