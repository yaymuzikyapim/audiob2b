export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import { getAdminOverviewData } from "@/lib/admin-overview";
import { fmtDate } from "@/lib/format-date";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronRight,
} from "lucide-react";

// ── Yardımcı: sayıyı tr-TR formatla ─────────────────────────────────────────

function n(v: number) {
  return v.toLocaleString("tr-TR");
}

// ── Durum etiketi ────────────────────────────────────────────────────────────

function StatusBadge({ isActive, endDate, today }: { isActive: boolean; endDate: Date; today: Date }) {
  if (!isActive) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-700/60 text-gray-400">
        Pasif
      </span>
    );
  }
  if (endDate < today) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-400/10 text-red-400">
        Süresi dolmuş
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400">
      Aktif
    </span>
  );
}

// ── Bitiş tarihi rengi ───────────────────────────────────────────────────────

function endDateColor(endDate: Date, today: Date, in30Days: Date) {
  if (endDate < today) return "text-red-400";
  if (endDate < in30Days) return "text-amber-400";
  return "text-gray-400";
}

// ── Şirket baş harfi ─────────────────────────────────────────────────────────

function InitialBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-700 text-gray-300 text-xs font-bold uppercase shrink-0">
      {name.trim()[0] ?? "?"}
    </span>
  );
}

// ── KPI Kart ─────────────────────────────────────────────────────────────────

function KpiCard({
  href,
  label,
  value,
  sub,
  accentClass,
}: {
  href: string;
  label: string;
  value: number;
  sub: string;
  accentClass: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-[10px] border border-[#263449] bg-[#111c2d] p-5 hover:border-gray-600 transition-colors"
    >
      <div className={`text-[29px] font-bold leading-none tabular-nums ${accentClass}`}>
        {n(value)}
      </div>
      <div className="text-sm font-semibold text-[#edf3fb]">{label}</div>
      <div className="text-xs text-[#75849a]">{sub}</div>
    </Link>
  );
}

// ── Uyarı satırı ─────────────────────────────────────────────────────────────

type WarningLevel = "danger" | "warning" | "info";

function WarningRow({
  level,
  title,
  description,
  href,
}: {
  level: WarningLevel;
  title: string;
  description?: React.ReactNode;
  href: string;
}) {
  const config = {
    danger: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-400/8" },
    warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-400/8" },
    info: { icon: Info, color: "text-blue-400", bg: "bg-blue-400/8" },
  }[level];
  const Icon = config.icon;

  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="flex items-start gap-3 min-w-0">
        <span className={`mt-0.5 shrink-0 ${config.color}`}>
          <Icon size={16} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#edf3fb]">{title}</div>
          {description && <div className="text-xs text-[#75849a] mt-0.5">{description}</div>}
        </div>
      </div>
      <Link
        href={href}
        className="shrink-0 text-xs font-medium text-[#a0aec0] hover:text-[#edf3fb] transition-colors flex items-center gap-1 whitespace-nowrap"
      >
        Görüntüle <ChevronRight size={12} />
      </Link>
    </div>
  );
}

// ── Sayfa ────────────────────────────────────────────────────────────────────

export default async function AdminOverviewPage() {
  const user = await getCurrentUser();
  if (!user || !user.isActive || user.role !== "SUPER_ADMIN") redirect("/login");

  const d = await getAdminOverviewData();
  const { bookStats, companyStats, packageStats, userStats, recentCompanies, todayMidnightUTC, in30DaysUTC, warnings } = d;

  // Kitap alt satırı
  const bookSub = bookStats.passive > 0
    ? `${n(bookStats.listenable)} dinlenebilir · ${n(bookStats.passive)} pasif`
    : `${n(bookStats.listenable)} dinlenebilir`;

  // Uyarı satırları (yalnızca count > 0 olanlar)
  const hasWarnings =
    warnings.expiredLicenseActive.length > 0 ||
    warnings.expiringSoonCount > 0 ||
    warnings.seatsFull.length > 0 ||
    warnings.demoCount > 0 ||
    warnings.invitesPending.total > 0 ||
    warnings.missingAudioCount > 0;

  return (
    <div>
      {/* Başlık */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#edf3fb]">Genel Bakış</h1>
          <p className="text-[#75849a] mt-1 text-sm">Platform özeti ve dikkat gerektiren işler</p>
        </div>
        <Link
          href="/admin/companies/new"
          className="shrink-0 whitespace-nowrap px-4 py-2.5 bg-[#35d2a1] hover:bg-[#2bb88b] text-[#080d17] text-sm font-semibold rounded-lg transition-colors"
        >
          + Şirket ekle
        </Link>
      </div>

      {/* KPI kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <KpiCard
          href="/admin/companies"
          label="Toplam şirket"
          value={companyStats.total}
          sub={`${n(companyStats.active)} aktif`}
          accentClass="text-[#35d2a1]"
        />
        <KpiCard
          href="/admin/books"
          label="Kitap kataloğu"
          value={bookStats.total}
          sub={bookSub}
          accentClass="text-[#79aaff]"
        />
        <KpiCard
          href="/admin/packages"
          label="Tanımlı paket"
          value={packageStats.total}
          sub={`${n(packageStats.usedCount)} şirkette kullanımda`}
          accentClass="text-purple-400"
        />
        <KpiCard
          href="#"
          label="Toplam kullanıcı"
          value={userStats.total}
          sub={`${n(userStats.active)} aktif`}
          accentClass="text-orange-400"
        />
      </div>

      {/* Dikkat gerektirenler */}
      <div className="rounded-[10px] border border-[#263449] bg-[#111c2d] mb-8">
        <div className="px-5 py-4 border-b border-[#263449]">
          <h2 className="text-base font-semibold text-[#edf3fb]">Dikkat gerektirenler</h2>
        </div>

        {!hasWarnings ? (
          <div className="px-5 py-6 text-sm text-[#75849a]">
            Şu an dikkat gerektiren bir konu yok.
          </div>
        ) : (
          <div className="divide-y divide-[#263449]">
            {warnings.expiredLicenseActive.length > 0 && (
              <WarningRow
                level="danger"
                title={`${n(warnings.expiredLicenseActive.length)} şirketin lisansı bitmiş ama hâlâ aktif`}
                href="/admin/companies?suresiDolmus=1"
              />
            )}

            {warnings.expiringSoonCount > 0 && (
              <WarningRow
                level="warning"
                title={`${n(warnings.expiringSoonCount)} şirketin lisansı 30 gün içinde bitiyor`}
                description={
                  <span>
                    {warnings.expiringSoon.map((c, i) => (
                      <span key={c.id}>
                        {i > 0 && " · "}
                        {c.name} — {fmtDate(c.endDate)}
                      </span>
                    ))}
                  </span>
                }
                href="/admin/companies?yakindaBitiyor=1"
              />
            )}

            {warnings.seatsFull.length > 0 && (
              <WarningRow
                level="warning"
                title={`${n(warnings.seatsFull.length)} şirkette koltukların %90'ı dolu`}
                href="/admin/companies?koltukDolu=1"
              />
            )}

            {warnings.demoCount > 0 && (
              <WarningRow
                level="info"
                title={`Son 7 günde ${n(warnings.demoCount)} demo talebi`}
                href="/admin/demo-requests"
              />
            )}

            {warnings.invitesPending.total > 0 && (
              <WarningRow
                level="info"
                title={`${n(warnings.invitesPending.total)} davet 7 günden uzun süredir kabul edilmedi`}
                description={
                  <span>
                    {warnings.invitesPending.topCompanies.map((c, i) => (
                      <span key={c.id}>
                        {i > 0 && " · "}
                        {c.name} — {n(c.count)} davet
                      </span>
                    ))}
                    {warnings.invitesPending.expired > 0 && (
                      <span> ({n(warnings.invitesPending.expired)} tanesinin süresi dolmuş)</span>
                    )}
                  </span>
                }
                href="/admin/companies?bekleyenDavet=1"
              />
            )}

            {warnings.missingAudioCount > 0 && (
              <WarningRow
                level="warning"
                title={`${n(warnings.missingAudioCount)} kitabın ses dosyası eksik`}
                href="/admin/books?audioFilter=missing"
              />
            )}
          </div>
        )}
      </div>

      {/* Şirketler tablosu */}
      <div className="rounded-[10px] border border-[#263449] bg-[#111c2d]">
        {/* Tablo başlığı */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#263449]">
          <div>
            <h2 className="text-base font-semibold text-[#edf3fb]">Şirketler</h2>
            <p className="text-xs text-[#75849a] mt-0.5">En son eklenen 5 şirket</p>
          </div>
          <Link
            href="/admin/companies"
            className="whitespace-nowrap text-xs font-medium text-[#a0aec0] hover:text-[#edf3fb] transition-colors flex items-center gap-1"
          >
            Tüm şirketler <ChevronRight size={12} />
          </Link>
        </div>

        {/* Tablo — masaüstü */}
        {recentCompanies.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[#75849a]">
            Henüz şirket yok.{" "}
            <Link href="/admin/companies/new" className="text-[#35d2a1] hover:underline">
              Şirket ekle
            </Link>
          </div>
        ) : (
          <>
            {/* Masaüstü tablo (md+) */}
            <div className="hidden md:block overflow-x-auto">
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
                  {recentCompanies.map((c) => (
                    <tr key={c.id} className="hover:bg-[#0d1726]/60 transition-colors">
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/companies/${c.id}`}
                          className="flex items-center gap-2.5 hover:text-[#35d2a1] transition-colors"
                        >
                          <InitialBadge name={c.name} />
                          <span className="font-medium text-[#edf3fb]">{c.name}</span>
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge isActive={c.isActive} endDate={c.endDate} today={todayMidnightUTC} />
                      </td>
                      <td className="px-5 py-4 tabular-nums text-[#a0aec0]">
                        {c.activeSeats} / {c.maxSeats}
                        {c.pendingSeats > 0 && (
                          <span className="ml-1.5 text-xs text-[#75849a]">+{c.pendingSeats} davet</span>
                        )}
                      </td>
                      <td className={`px-5 py-4 tabular-nums ${endDateColor(c.endDate, todayMidnightUTC, in30DaysUTC)}`}>
                        {fmtDate(c.endDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobil kart listesi (<md) */}
            <div className="md:hidden divide-y divide-[#263449]">
              {recentCompanies.map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/companies/${c.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-[#0d1726]/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <InitialBadge name={c.name} />
                    <div className="min-w-0">
                      <div className="font-medium text-[#edf3fb] truncate">{c.name}</div>
                      <div className="text-xs text-[#75849a] mt-0.5 tabular-nums">
                        {c.activeSeats} / {c.maxSeats} koltuk ·{" "}
                        <span className={endDateColor(c.endDate, todayMidnightUTC, in30DaysUTC)}>
                          {fmtDate(c.endDate)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <StatusBadge isActive={c.isActive} endDate={c.endDate} today={todayMidnightUTC} />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
