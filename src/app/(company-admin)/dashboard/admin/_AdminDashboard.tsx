"use client";

import { useEffect, useState } from "react";
import { fmtLongDate } from "@/lib/format-date";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Users, Clock, BookOpen, TrendingUp } from "lucide-react";
import Link from "next/link";

interface MetricsData {
  period: string;
  from: string;
  to: string;
  company: {
    name: string;
    brandColor: string;
    maxSeats: number;
    logoUrl: string | null;
    endDate: string;
  } | null;
  activeListeners: number;
  totalListenedSec: number;
  completedBooks: number;
  totalSeats: number;
  occupiedSeats: number;
  pendingInvites: number;
  firstV2Date: string | null;
  firstChapterDate: string | null;
  trend: Array<{ weekStart: string; listenedSec: number; activeUsers: number }>;
  funnel: {
    seats: number;
    invitesSent: number;
    invitesAccepted: number;
    hasPlayedEver: number;
    activeInPeriod: number;
    neverPlayed: number;
  };
  topBooks: Array<{
    bookId: string;
    title: string;
    author: string;
    coverUrl: string | null;
    listenedSec: number;
    listenerCount: number;
    pct: number;
  }>;
  prev: {
    activeListeners: number;
    totalListenedSec: number;
    completedBooks: number;
  } | null;
}

function fmtHours(sec: number) {
  if (sec === 0) return "0 sa";
  const h = sec / 3600;
  if (h >= 1000) return `${(h / 1000).toFixed(1)}B sa`;
  if (h >= 10) return `${Math.round(h)} sa`;
  if (h >= 1) return `${Math.floor(h)} sa ${Math.round((h % 1) * 60)} dk`;
  const m = Math.floor(sec / 60);
  if (m > 0) return `${m} dk`;
  return `${sec} sn`;
}

function fmtWeekLabel(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"][d.getUTCMonth()]}`;
}

function fmtDate(iso: string) {
  return fmtLongDate(iso);
}

function fmtDateRange(from: string, to: string) {
  const f = new Date(from);
  const t = new Date(to);
  const months = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  return `${f.getDate()} ${months[f.getMonth()]} – ${t.getDate()} ${months[t.getMonth()]} ${t.getFullYear()}`;
}

function deltaPct(cur: number, prev: number): number | null {
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) return null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 100);
}

const PERIODS = [
  { label: "Son 30 gün", value: "30d" },
  { label: "Bu çeyrek", value: "quarter" },
  { label: "Bu yıl", value: "year" },
];

export default function AdminOverviewPage() {
  const [period, setPeriod] = useState("30d");
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/dashboard/admin/metrics?period=${period}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [period]);

  const brand = data?.company?.brandColor || "#1E5AA8";
  const accentSoft = brand + "14";

  return (
    <div style={{ padding: "32px clamp(16px, 3vw, 40px) 48px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1200, margin: "0 auto" }}>

      {/* Başlık + Dönem seçici */}
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em", color: "#14181F" }}>
            Genel Bakış
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#5A6270" }}>
            {data ? fmtDateRange(data.from, data.to) : "Yükleniyor…"}
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 500,
                minHeight: 44,
                padding: "0 16px",
                borderRadius: 8,
                border: period === p.value ? `1.5px solid ${brand}` : "1px solid #CDD2D9",
                background: period === p.value ? accentSoft : "#FFFFFF",
                color: period === p.value ? brand : "#3A414C",
                cursor: "pointer",
                transition: "all .15s",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 240, fontSize: 14, color: "#9EA6B3" }}>
          Yükleniyor…
        </div>
      )}
      {error && (
        <div style={{ borderRadius: 12, padding: "14px 16px", background: "#FEE2E2", color: "#991B1B", fontSize: 14 }}>
          Veriler yüklenemedi: {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Lisans kullanımı bölümü */}
          {(() => {
            const occupied = data.occupiedSeats;
            const pending = data.pendingInvites;
            const max = data.totalSeats;
            const overflow = max > 0 && (occupied + pending) > max;
            const fillPct = max > 0 ? Math.min(100, ((occupied + pending) / max) * 100) : 0;
            const barColor = overflow ? "#DC2626" : brand;
            return (
              <section
                aria-label="Lisans kullanımı"
                style={{ background: "#FFFFFF", border: `1px solid ${overflow ? "#FCA5A5" : "#E3E6EA"}`, borderRadius: 12, padding: "20px 24px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 24 }}
              >
                <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#14181F" }}>Lisans kullanımı</span>
                    <span style={{ fontSize: 14, color: overflow ? "#991B1B" : "#3A414C", fontVariantNumeric: "tabular-nums" }}>
                      <strong style={{ fontSize: 18, color: overflow ? "#DC2626" : "#14181F" }}>{occupied}</strong> / {max} kullanıcı
                    </span>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: "#E9ECF0", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 999,
                        background: barColor,
                        width: `${fillPct}%`,
                        transition: "width .4s ease",
                      }}
                    />
                  </div>
                  {overflow ? (
                    <span style={{ fontSize: 13, color: "#DC2626", fontWeight: 600 }}>
                      Lisans sınırı aşıldı: {occupied + pending} / {max}
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, color: "#5A6270" }}>
                      {pending > 0 ? `${pending} davet yanıt bekliyor` : `${Math.max(0, max - occupied - pending)} boş lisans`}
                    </span>
                  )}
                </div>
                {data.company?.endDate && (
                  <div style={{ flex: "0 1 auto", display: "flex", flexDirection: "column", gap: 4, paddingLeft: 24, borderLeft: "1px solid #E3E6EA" }}>
                    <span style={{ fontSize: 13, color: "#5A6270" }}>Lisans bitişi</span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: "#14181F" }}>{fmtDate(data.company.endDate)}</span>
                    <span style={{ fontSize: 13, color: "#5A6270" }}>Tüm kütüphane erişimi</span>
                  </div>
                )}
              </section>
            );
          })()}

          {/* KPI Kartları (4 adet) */}
          {(() => {
            const prev = data.prev;
            const perListenerSec = data.activeListeners > 0 ? Math.round(data.totalListenedSec / data.activeListeners) : 0;
            const prevPerListenerSec = prev && prev.activeListeners > 0 ? Math.round(prev.totalListenedSec / prev.activeListeners) : 0;

            const cards = [
              {
                icon: <Users size={20} />,
                label: "Aktif dinleyici",
                value: data.activeListeners.toLocaleString("tr-TR"),
                sub: `/ ${data.occupiedSeats} kullanıcı`,
                delta: prev ? deltaPct(data.activeListeners, prev.activeListeners) : null,
              },
              {
                icon: <Clock size={20} />,
                label: "Toplam dinleme",
                value: fmtHours(data.totalListenedSec),
                sub: "bu dönemde",
                delta: prev ? deltaPct(data.totalListenedSec, prev.totalListenedSec) : null,
              },
              {
                icon: <TrendingUp size={20} />,
                label: "Dinleyici başına",
                value: fmtHours(perListenerSec),
                sub: "kişi başına ortalama",
                delta: prev ? deltaPct(perListenerSec, prevPerListenerSec) : null,
              },
              {
                icon: <BookOpen size={20} />,
                label: "Tamamlanan kitap",
                value: data.completedBooks.toLocaleString("tr-TR"),
                sub: "bu dönemde",
                delta: prev ? deltaPct(data.completedBooks, prev.completedBooks) : null,
              },
            ];

            return (
              <section
                aria-label="Temel göstergeler"
                style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}
              >
                {cards.map((c) => (
                  <StatCard key={c.label} icon={c.icon} label={c.label} value={c.value} sub={c.sub} delta={c.delta} brand={brand} />
                ))}
              </section>
            );
          })()}

          {/* Trend Grafiği + Katılım Hunisi */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
            <section
              aria-label="Haftalık dinleme eğilimi"
              style={{ flex: "2 1 520px", minWidth: 0, background: "#FFFFFF", border: "1px solid #E3E6EA", borderRadius: 12, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}
            >
              {(() => {
                const maxSec = data.trend.reduce((m, t) => Math.max(m, t.listenedSec), 0);
                const yLabel = maxSec < 3600 ? "Haftalık dinleme (dakika)" : "Haftalık dinleme (saat)";
                const yFmt = (v: number) => {
                  if (maxSec < 3600) return `${Math.round(v / 60)}`;
                  return `${(v / 3600).toFixed(maxSec < 7200 ? 1 : 0)}`;
                };
                const ttFmt = (v: unknown): [string, string] => {
                  const sec = v as number;
                  if (maxSec < 3600) return [`${Math.round(sec / 60)} dk`, "Dinleme"];
                  return [`${(sec / 3600).toFixed(1)} sa`, "Dinleme"];
                };
                return (
                  <>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#14181F" }}>{yLabel}</h2>
                      <span style={{ fontSize: 13, color: "#5A6270" }}>Son 12 hafta</span>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={data.trend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={brand} stopOpacity={0.18} />
                            <stop offset="95%" stopColor={brand} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F3" vertical={false} />
                        <XAxis
                          dataKey="weekStart"
                          tickFormatter={fmtWeekLabel}
                          tick={{ fontSize: 11, fill: "#9EA6B3" }}
                          axisLine={false}
                          tickLine={false}
                          interval={1}
                        />
                        <YAxis
                          tickFormatter={yFmt}
                          tick={{ fontSize: 11, fill: "#9EA6B3" }}
                          axisLine={false}
                          tickLine={false}
                          width={36}
                          domain={maxSec === 0 ? [0, 3600] : [0, "auto"]}
                        />
                        <Tooltip
                          formatter={ttFmt}
                          labelFormatter={(label) => fmtWeekLabel(String(label))}
                          contentStyle={{ borderRadius: 10, border: "1px solid #E3E6EA", fontSize: 12 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="listenedSec"
                          stroke={brand}
                          strokeWidth={2.5}
                          fill="url(#trendGrad)"
                          dot={false}
                          activeDot={{ r: 4, fill: brand }}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </>
                );
              })()}
            </section>

            {/* Katılım Hunisi */}
            <section
              aria-label="Katılım"
              style={{ flex: "1 1 280px", background: "#FFFFFF", border: "1px solid #E3E6EA", borderRadius: 12, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}
            >
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#14181F" }}>Katılım</h2>
              <FunnelViz funnel={data.funnel} brand={brand} />
            </section>
          </div>

          {/* En Çok Dinlenenler */}
          <section
            aria-label="En çok dinlenen kitaplar"
            style={{ background: "#FFFFFF", border: "1px solid #E3E6EA", borderRadius: 12, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#14181F" }}>En çok dinlenen kitaplar</h2>
              <Link
                href="/dashboard/admin/reports"
                style={{ fontSize: 14, fontWeight: 600, textDecoration: "none", minHeight: 44, display: "flex", alignItems: "center", color: brand }}
              >
                Tüm rapor →
              </Link>
            </div>
            {data.topBooks.length === 0 ? (
              <p style={{ fontSize: 14, color: "#9EA6B3", textAlign: "center", padding: "24px 0", margin: 0 }}>
                Bu dönemde veri yok.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {data.topBooks.map((book, i) => (
                  <div
                    key={book.bookId}
                    style={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1fr) minmax(80px, 2fr) 90px", gap: 16, alignItems: "center", padding: "12px 0", borderTop: i > 0 ? "1px solid #EEF0F3" : "none" }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: i === 0 ? brand : "#5A6270", fontVariantNumeric: "tabular-nums", textAlign: "center" }}>
                      {i + 1}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#14181F" }}>
                        {book.title}
                      </span>
                      <span style={{ fontSize: 13, color: "#5A6270" }}>{book.listenerCount} dinleyici</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: "#E9ECF0", overflow: "hidden" }}>
                      <div style={{ width: `${book.pct}%`, height: "100%", borderRadius: 999, background: brand }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#14181F" }}>
                      {fmtHours(book.listenedSec)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Dipnot */}
          <p style={{ margin: 0, fontSize: 12, color: "#9EA6B3", lineHeight: 1.6 }}>
            Dinleme süreleri{data.firstV2Date ? ` ${fmtDate(data.firstV2Date)} itibarıyla` : ""} gerçek dinlenen süreye göre hesaplanır; ileri sarılan bölümler sayılmaz.
            {data.firstChapterDate && (
              <> Kitap tamamlama verisi {fmtDate(data.firstChapterDate)} itibarıyla geçerlidir (önceki kayıtlarda bölüm bilgisi yok).</>
            )}
          </p>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  delta,
  brand,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  delta: number | null;
  brand: string;
}) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E3E6EA", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "#5A6270" }}>{label}</span>
        <span style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: brand + "14", color: brand }}>
          {icon}
        </span>
      </div>
      <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", color: "#14181F" }}>
        {value}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#9EA6B3" }}>{sub}</span>
        {delta !== null && (
          <span style={{
            fontSize: 12, fontWeight: 600, padding: "2px 6px", borderRadius: 99,
            background: delta >= 0 ? "#F0FDF4" : "#FFF7ED",
            color: delta >= 0 ? "#1B7F4C" : "#A3410F",
          }}>
            {delta >= 0 ? "+" : ""}{delta}%
          </span>
        )}
      </div>
    </div>
  );
}

function FunnelViz({
  funnel,
  brand,
}: {
  funnel: MetricsData["funnel"];
  brand: string;
}) {
  const max = Math.max(funnel.invitesSent, 1);
  const steps = [
    { label: "Davet gönderildi", value: funnel.invitesSent, pct: 100, color: "#9AA3AF" },
    { label: "Davet kabul edildi", value: funnel.invitesAccepted, pct: Math.round((funnel.invitesAccepted / max) * 100), color: "#5C7FB8" },
    { label: "En az bir kez dinledi", value: funnel.hasPlayedEver, pct: Math.round((funnel.hasPlayedEver / max) * 100), color: brand },
    { label: "Aktif (bu dönem)", value: funnel.activeInPeriod, pct: Math.round((funnel.activeInPeriod / max) * 100), color: "#123E78" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
      {steps.map((s) => (
        <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "#3A414C" }}>{s.label}</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "#14181F" }}>{s.value.toLocaleString("tr-TR")}</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "#E9ECF0", overflow: "hidden" }}>
            <div style={{ width: `${s.pct}%`, height: "100%", borderRadius: 999, background: s.color }} />
          </div>
        </div>
      ))}
      {funnel.neverPlayed > 0 && (
        <div style={{ marginTop: 8, background: "#FFF6EC", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#6B3A10" }}>
            <strong>{funnel.neverPlayed.toLocaleString("tr-TR")} kişi</strong> davetini kabul etti ama hiç dinlemedi.
          </span>
          <Link
            href="/dashboard/admin/users?tab=never"
            style={{ alignSelf: "flex-start", fontSize: 14, fontWeight: 600, minHeight: 44, display: "flex", alignItems: "center", textDecoration: "none", color: "#8A4A0F" }}
          >
            Hatırlatma gönder →
          </Link>
        </div>
      )}
    </div>
  );
}
