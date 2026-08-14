import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import InviteButton from "@/components/dashboard/InviteButton";
import MemberActions from "@/components/dashboard/MemberActions";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

export default async function TeamPage() {
  const session = await getSession();
  if (!session || session.role !== "COMPANY_ADMIN") redirect("/dashboard");
  if (!session.companyId) redirect("/dashboard");

  const [users, company, pendingInvites] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: session.companyId, role: { not: "SUPER_ADMIN" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    }),
    prisma.company.findUnique({
      where: { id: session.companyId },
      select: { maxSeats: true, name: true, _count: { select: { users: true } } },
    }),
    prisma.inviteToken.findMany({
      where: { companyId: session.companyId, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
    }),
  ]);

  const usedSeats = company?._count.users ?? 0;
  const maxSeats = company?.maxSeats ?? 0;
  const remaining = Math.max(0, maxSeats - usedSeats);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Ekip</h1>
          <p className="text-gray-400 mt-1 text-sm">
            {usedSeats} / {maxSeats} koltuk kullanılıyor · {remaining} koltuk boş
          </p>
        </div>
        <InviteButton companyId={session.companyId} remaining={remaining} />
      </div>

      {/* Koltuk kullanım çubuğu */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">Lisans kullanımı</span>
          <span className="text-white">{usedSeats} / {maxSeats}</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${usedSeats / maxSeats > 0.9 ? "bg-red-500" : "bg-blue-500"}`}
            style={{ width: `${Math.min(100, (usedSeats / maxSeats) * 100)}%` }}
          />
        </div>
      </div>

      {/* Aktif kullanıcılar */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl mb-6">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">Aktif Üyeler ({users.length})</h2>
        </div>
        <div className="divide-y divide-gray-800">
          {users.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500 text-sm">
              Henüz üye yok. Davet göndererek başlayın.
            </div>
          )}
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-white text-sm font-semibold">
                  {(u.name || u.email)[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-white text-sm font-medium">{u.name || "—"}</div>
                  <div className="text-gray-500 text-xs">{u.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-xs hidden lg:block">
                  {u.lastLoginAt ? `Son giriş: ${formatDate(u.lastLoginAt)}` : "Henüz giriş yapmadı"}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  u.role === "COMPANY_ADMIN" ? "bg-purple-400/10 text-purple-400" : "bg-gray-800 text-gray-400"
                }`}>
                  {u.role === "COMPANY_ADMIN" ? "Yönetici" : "Çalışan"}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${u.isActive ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
                  {u.isActive ? "Aktif" : "Pasif"}
                </span>
                <MemberActions userId={u.id} isActive={u.isActive} isSelf={u.id === session.id} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bekleyen davetler */}
      {pendingInvites.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">Bekleyen Davetler ({pendingInvites.length})</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <div className="text-white text-sm font-medium">{inv.email}</div>
                  <div className="text-gray-500 text-xs mt-0.5">
                    Gönderildi: {formatDate(inv.createdAt)} · Son: {formatDate(inv.expiresAt)}
                  </div>
                </div>
                <span className="text-xs bg-yellow-400/10 text-yellow-400 px-2.5 py-1 rounded-full font-medium">
                  Bekliyor
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
