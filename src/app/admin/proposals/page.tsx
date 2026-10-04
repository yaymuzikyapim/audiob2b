import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import NewLinkForm from "./NewLinkForm";

function fmt(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function ProposalsPage() {
  const auth = await requireUser({ roles: ["SUPER_ADMIN"] });
  if (!auth.ok) redirect("/login");

  const links = await prisma.proposalLink.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      visitors: { orderBy: { firstSeenAt: "asc" } },
    },
  });

  const host = "https://www.audiob2b.com.tr";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Teklif Bağlantıları</h1>
          <p className="text-gray-500 text-sm mt-1">Token tabanlı teklifler — her açılış izlenir</p>
        </div>
        <NewLinkForm />
      </div>

      {links.length === 0 && (
        <div className="text-gray-600 text-sm">Henüz bağlantı yok.</div>
      )}

      <div className="space-y-6">
        {links.map((link) => {
          const totalViews = link.visitors.reduce((s, v) => s + v.views, 0);
          const uniqueBrowsers = link.visitors.length;
          const firstSeen = link.visitors[0]?.firstSeenAt ?? null;
          const lastSeen = link.visitors.length > 0
            ? link.visitors.reduce((m, v) => (v.lastSeenAt > m ? v.lastSeenAt : m), link.visitors[0].lastSeenAt)
            : null;
          const expired = link.expiresAt < new Date();
          const url = `${host}/p/${link.token}`;

          return (
            <div key={link.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              {/* Başlık satırı */}
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-white font-semibold text-lg">{link.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      expired ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"
                    }`}>
                      {expired ? "Süresi doldu" : `${fmt(link.expiresAt)}'e kadar geçerli`}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="text-xs text-gray-500 font-mono">{url}</code>
                    <button
                      onClick={undefined}
                      className="text-[11px] text-gray-600 hover:text-emerald-400 transition-colors"
                      title="Kopyala"
                    >
                    </button>
                  </div>
                </div>
                <a
                  href={url} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Önizle ↗
                </a>
              </div>

              {/* Özet sayaçlar */}
              <div className="grid grid-cols-4 gap-4 mb-5">
                {[
                  { label: "Toplam Görüntülenme", value: totalViews },
                  { label: "Farklı Tarayıcı", value: uniqueBrowsers },
                  { label: "İlk Açılış", value: fmt(firstSeen) },
                  { label: "Son Açılış", value: fmt(lastSeen) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-800/60 rounded-xl p-3">
                    <div className="text-gray-500 text-[11px] mb-1">{label}</div>
                    <div className="text-white font-semibold text-sm">{value}</div>
                  </div>
                ))}
              </div>

              {/* Ziyaretçi listesi */}
              {link.visitors.length > 0 && (
                <div>
                  <div className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-2">
                    Tarayıcı bazlı
                  </div>
                  <div className="border border-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="text-left text-[11px] text-gray-500 font-medium px-4 py-2.5 uppercase tracking-wide">#</th>
                          <th className="text-left text-[11px] text-gray-500 font-medium px-4 py-2.5 uppercase tracking-wide">İlk Açılış</th>
                          <th className="text-left text-[11px] text-gray-500 font-medium px-4 py-2.5 uppercase tracking-wide">Son Açılış</th>
                          <th className="text-right text-[11px] text-gray-500 font-medium px-4 py-2.5 uppercase tracking-wide">Görüntülenme</th>
                        </tr>
                      </thead>
                      <tbody>
                        {link.visitors.map((v, i) => (
                          <tr key={v.visitorId} className="border-b border-gray-800/50 last:border-0">
                            <td className="px-4 py-2.5 text-gray-600 tabular-nums">{i + 1}</td>
                            <td className="px-4 py-2.5 text-gray-300">{fmt(v.firstSeenAt)}</td>
                            <td className="px-4 py-2.5 text-gray-400">{fmt(v.lastSeenAt)}</td>
                            <td className="px-4 py-2.5 text-gray-300 text-right tabular-nums">{v.views}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
