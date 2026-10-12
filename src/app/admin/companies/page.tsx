export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format-date";
import { getCompanySeatMap } from "@/lib/admin-overview";
import { TZ_OFFSET_MS, istanbulMidnightUTC } from "@/lib/tz-utils";
import { X } from "lucide-react";

// ── Yardımcılar ──────────────────────────────────────────────────────────────

function todayMidnight(now: Date) {
  const ist = new Date(now.getTime() + TZ_OFFSET_MS);
  return istanbulMidnightUTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
}

type ActiveFilter = "suresiDolmus" | "yakindaBitiyor" | "koltukDolu" | "bekleyenDavet" | null;

const FILTER_LABELS: Record<NonNullable<ActiveFilter>, string> = {
  suresiDolmus: "Süresi dolmuş ama aktif",
  yakindaBitiyor: "30 gün içinde bitiyor",
  koltukDolu: "Koltukların %90'ı dolu",
  bekleyenDavet: "7 gün+ kabul edilmeyen davet",
};

function StatusBadge({ isActive, endDate, today }: { isActive: boolean; endDate: Date; today: Date }) {
  if (!isActive) {
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-700/60 text-gray-400">Pasif</span>;
  }
  if (endDate < today) {
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-400/10 text-red-400">Süresi dolmuş</span>;
  }
  return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400">Aktif</span>;
}

// ── Sayfa ────────────────────────────────────────────────────────────────────

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive || user.role !== "SUPER_ADMIN") redirect("/login");

  const params = await searchParams;
  const now = new Date();
  const today = todayMidnight(now);
  const in30Days = new Date(today.getTime() + 30 * 86400 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400 * 1000);

  // Aktif filtre (en fazla biri)
  const activeFilter: ActiveFilter =
    params.suresiDolmus === "1" ? "suresiDolmus" :
    params.yakindaBitiyor === "1" ? "yakindaBitiyor" :
    params.koltukDolu === "1" ? "koltukDolu" :
    params.bekleyenDavet === "1" ? "bekleyenDavet" :
    null;

  // Prisma where (koltukDolu JS tarafında filtreleneceği için özel durum)
  const where =
    activeFilter === "suresiDolmus" ? { isActive: true, endDate: { lt: today } } :
    activeFilter === "yakindaBitiyor" ? { endDate: { gte: today, lt: in30Days } } :
    activeFilter === "bekleyenDavet" ? { inviteTokens: { some: { usedAt: null, createdAt: { lt: sevenDaysAgo } } } } :
    {};

  const allCompanies = await prisma.company.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, slug: true, isActive: true,
      endDate: true, maxSeats: true, licenseType: true,
      package: { select: { name: true } },
      _count: { select: { users: true } },
    },
  });

  // koltukDolu: seat map hesapla, JS'de filtrele
  let companies = allCompanies;
  let seatMap: { activeMap: Map<string, number>; pendingMap: Map<string, number> } | null = null;

  if (activeFilter === "koltukDolu" || activeFilter === null) {
    // Her zaman tüm şirketler için seat map — tablo koltuk kolonunda da kullanılır
    seatMap = await getCompanySeatMap(allCompanies.map((c) => c.id), now);
    if (activeFilter === "koltukDolu") {
      companies = allCompanies.filter((c) => {
        const active = seatMap!.activeMap.get(c.id) ?? 0;
        const pending = seatMap!.pendingMap.get(c.id) ?? 0;
        return c.maxSeats > 0 && (active + pending) / c.maxSeats >= 0.9;
      });
    }
  }

  const getSeatData = (id: string) => ({
    active: seatMap?.activeMap.get(id) ?? 0,
    pending: seatMap?.pendingMap.get(id) ?? 0,
  });

  return (
    <div>
      {/* Başlık */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#edf3fb]">Şirketler</h1>
          <p className="text-[#75849a] mt-1 text-sm">
            {companies.length} şirket{activeFilter ? " (filtrelenmiş)" : " kayıtlı"}
          </p>
        </div>
        <Link
          href="/admin/companies/new"
          className="whitespace-nowrap px-4 py-2.5 bg-[#35d2a1] hover:bg-[#2bb88b] text-[#080d17] text-sm font-semibold rounded-lg transition-colors"
        >
          + Şirket Ekle
        </Link>
      </div>

      {/* Aktif filtre etiketi */}
      {activeFilter && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-[#75849a]">Filtre:</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#1a2a3a] text-[#a0aec0] border border-[#263449]">
            {FILTER_LABELS[activeFilter]}
            <Link href="/admin/companies" aria-label="Filtreyi kaldır">
              <X size={12} className="hover:text-[#edf3fb] transition-colors" />
            </Link>
          </span>
        </div>
      )}

      {/* Tablo */}
      <div className="rounded-[10px] border border-[#263449] bg-[#111c2d] overflow-hidden">
        {companies.length === 0 ? (
          <div className="px-6 py-16 text-center text-[#75849a] text-sm">
            {activeFilter ? (
              <>
                Bu filtreyle eşleşen şirket yok.{" "}
                <Link href="/admin/companies" className="text-[#35d2a1] hover:underline">Filtreyi kaldır</Link>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">🏢</div>
                <div className="font-semibold text-[#edf3fb] mb-1">Henüz şirket yok</div>
                <div>İlk kurumsal müşteriyi eklemek için butona tıklayın.</div>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0d1726] text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-[#75849a] uppercase tracking-wide">Şirket</th>
                  <th className="px-5 py-3 text-xs font-semibold text-[#75849a] uppercase tracking-wide">Durum</th>
                  <th className="px-5 py-3 text-xs font-semibold text-[#75849a] uppercase tracking-wide">Koltuk</th>
                  <th className="px-5 py-3 text-xs font-semibold text-[#75849a] uppercase tracking-wide">Bitiş Tarihi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263449]">
                {companies.map((c) => {
                  const { active, pending } = getSeatData(c.id);
                  const endDatePast = c.endDate < today;
                  const endDateSoon = !endDatePast && c.endDate < in30Days;
                  return (
                    <tr key={c.id} className="hover:bg-[#0d1726]/60 transition-colors">
                      <td className="px-5 py-4">
                        <Link href={`/admin/companies/${c.id}`} className="font-medium text-[#edf3fb] hover:text-[#35d2a1] transition-colors">
                          {c.name}
                        </Link>
                        <div className="text-[#75849a] text-xs mt-0.5">/{c.slug}</div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge isActive={c.isActive} endDate={c.endDate} today={today} />
                      </td>
                      <td className="px-5 py-4 tabular-nums text-[#a0aec0]">
                        {active} / {c.maxSeats}
                        {pending > 0 && (
                          <span className="ml-1.5 text-xs text-[#75849a]">+{pending} davet</span>
                        )}
                      </td>
                      <td className={`px-5 py-4 tabular-nums ${endDatePast ? "text-red-400" : endDateSoon ? "text-amber-400" : "text-[#a0aec0]"}`}>
                        {fmtDate(c.endDate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
