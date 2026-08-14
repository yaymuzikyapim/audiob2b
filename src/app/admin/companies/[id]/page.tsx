import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CompanyActions from "@/components/admin/CompanyActions";
import AdminInviteButton from "@/components/admin/AdminInviteButton";
import CompanyBranding from "@/components/admin/CompanyBranding";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(d));
}

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      package: { select: { id: true, name: true } },
      users: {
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
      },
      _count: { select: { users: true, inviteTokens: true } },
    },
  });

  if (!company) notFound();

  const packages = await prisma.package.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const pendingInvites = await prisma.inviteToken.findMany({
    where: { companyId: id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
  });

  const daysLeft = Math.ceil((new Date(company.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/admin/companies" className="hover:text-white transition-colors">Şirketler</Link>
        <span>/</span>
        <span className="text-white">{company.name}</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{company.name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${company.isActive ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
              {company.isActive ? "Aktif" : "Pasif"}
            </span>
          </div>
          <p className="text-gray-400 mt-1 text-sm">/{company.slug}</p>
        </div>
        <CompanyActions company={company} packages={packages} />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="text-gray-500 text-xs uppercase tracking-wide mb-3">Lisans</div>
          <div className="text-white font-semibold">{company.licenseType === "PER_SEAT" ? "Koltuk Başına" : "Esnek Havuz"}</div>
          <div className="text-gray-400 text-sm mt-1">{company.maxSeats} koltuk · {company._count.users} kullanıcı</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="text-gray-500 text-xs uppercase tracking-wide mb-3">Paket</div>
          <div className="text-white font-semibold">{company.package?.name || "Paket yok"}</div>
          {company.package && (
            <Link href={`/admin/packages/${company.package.id}`} className="text-emerald-400 text-xs hover:underline mt-1 block">Paketi görüntüle →</Link>
          )}
        </div>
        <div className={`bg-gray-900 border rounded-2xl p-5 ${daysLeft < 30 ? "border-orange-500/30" : "border-gray-800"}`}>
          <div className="text-gray-500 text-xs uppercase tracking-wide mb-3">Sözleşme</div>
          <div className="text-white font-semibold">{formatDate(company.endDate)}'e kadar</div>
          <div className={`text-sm mt-1 ${daysLeft < 30 ? "text-orange-400" : "text-gray-400"}`}>
            {daysLeft > 0 ? `${daysLeft} gün kaldı` : "Süresi doldu"}
          </div>
        </div>
      </div>

      {company.notes && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
          <div className="text-gray-500 text-xs uppercase tracking-wide mb-2">İç Not</div>
          <p className="text-gray-300 text-sm">{company.notes}</p>
        </div>
      )}

      {/* Kurumsal görünüm */}
      <div className="mb-6">
        <CompanyBranding
          companyId={company.id}
          currentLogoUrl={company.logoUrl ?? null}
          currentBrandColor={company.brandColor ?? "#2563eb"}
        />
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl mb-6">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">Bekleyen Davetler ({pendingInvites.length})</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {pendingInvites.map((inv) => {
              const daysUntilExpiry = Math.ceil((new Date(inv.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              return (
                <div key={inv.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <div className="text-white text-sm">{inv.email}</div>
                    <div className="text-gray-500 text-xs mt-0.5">
                      {new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(inv.createdAt))} gönderildi
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{inv.role === "COMPANY_ADMIN" ? "Yönetici" : "Çalışan"}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${daysUntilExpiry <= 1 ? "bg-red-400/10 text-red-400" : "bg-yellow-400/10 text-yellow-400"}`}>
                      {daysUntilExpiry} gün kaldı
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">Kullanıcılar ({company._count.users})</h2>
          <AdminInviteButton companyId={company.id} />
        </div>
        <div className="divide-y divide-gray-800">
          {company.users.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500 text-sm">Henüz kullanıcı yok. Davet göndererek başlayın.</div>
          )}
          {company.users.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-6 py-4">
              <div>
                <div className="text-white text-sm font-medium">{u.name || "—"}</div>
                <div className="text-gray-500 text-xs mt-0.5">{u.email}</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-gray-500 text-xs">{u.role === "COMPANY_ADMIN" ? "Yönetici" : "Çalışan"}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${u.isActive ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
                  {u.isActive ? "Aktif" : "Pasif"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
