"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Users, Clock, BookOpen, Zap } from "lucide-react";

interface MetricsData {
  period: string;
  company: { name: string; brandColor: string; maxSeats: number; logoUrl: string | null };
  activeListeners: number;
  totalListenedSec: number;
  completedBooks: number;
  totalSeats: number;
  occupiedSeats: number;
  trend: Array<{ weekStart: string; listenedSec: number; activeUsers: number }>;
  funnel: { seats: number; hasPlayed: number; completed: number };
  topBooks: Array<{
    bookId: string;
    title: string;
    author: string;
    coverUrl: string | null;
    listenedSec: number;
    listenerCount: number;
  }>;
}

function fmtHours(sec: number) {
  const h = Math.round(sec / 3600);
  return h >= 1000 ? `${(h / 1000).toFixed(1)}B sa` : `${h} sa`;
}

function fmtWeekLabel(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"][d.getUTCMonth()]}`;
}

const PERIODS = [
  { label: "7 gün", value: "7d" },
  { label: "30 gün", value: "30d" },
  { label: "90 gün", value: "90d" },
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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Başlık */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "#14181F" }}>
            Genel Bakış
          </h1>
          <p className="text-sm mt-1" style={{ color: "#5A6270" }}>
            {data?.company?.name ?? "Yükleniyor…"}
          </p>
        </div>
        {/* Dönem seçici */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "#E3E6EA" }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={
                period === p.value
                  ? { background: "#fff", color: "#14181F", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }
                  : { color: "#5A6270" }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64 text-sm" style={{ color: "#9EA6B3" }}>
          Yükleniyor…
        </div>
      )}
      {error && (
        <div className="rounded-xl p-4 text-sm" style={{ background: "#FEE2E2", color: "#991B1B" }}>
          Veriler yüklenemedi: {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Stat Kartları */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<Users size={20} />}
              label="Aktif Dinleyici"
              value={data.activeListeners}
              sub={`/ ${data.occupiedSeats} kullanıcı`}
              brand={brand}
            />
            <StatCard
              icon={<Clock size={20} />}
              label="Toplam Dinleme"
              value={fmtHours(data.totalListenedSec)}
              sub="toplam saat"
              brand={brand}
            />
            <StatCard
              icon={<BookOpen size={20} />}
              label="Tamamlanan Kitap"
              value={data.completedBooks}
              sub="oturum"
              brand={brand}
            />
            <StatCard
              icon={<Zap size={20} />}
              label="Lisans Doluluk"
              value={`${data.occupiedSeats}/${data.totalSeats}`}
              sub="koltuk"
              brand={brand}
              extra={
                <div className="mt-3 w-full rounded-full h-1.5 overflow-hidden" style={{ background: "#E3E6EA" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (data.occupiedSeats / Math.max(1, data.totalSeats)) * 100)}%`,
                      background: brand,
                    }}
                  />
                </div>
              }
            />
          </div>

          {/* Trend Grafiği + Huni */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div
              className="lg:col-span-2 rounded-2xl p-6"
              style={{ background: "#fff", border: "1px solid #E3E6EA" }}
            >
              <h2 className="text-sm font-semibold mb-4" style={{ color: "#14181F" }}>
                Haftalık Dinleme (Saat)
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.trend} barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" vertical={false} />
                  <XAxis
                    dataKey="weekStart"
                    tickFormatter={fmtWeekLabel}
                    tick={{ fontSize: 11, fill: "#9EA6B3" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `${Math.round(v / 3600)}`}
                    tick={{ fontSize: 11, fill: "#9EA6B3" }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    formatter={(v) => [`${Math.round((v as number) / 3600)} sa`, "Dinleme"]}
                    labelFormatter={(label) => fmtWeekLabel(String(label))}
                    contentStyle={{ borderRadius: 10, border: "1px solid #E3E6EA", fontSize: 12 }}
                  />
                  <Bar dataKey="listenedSec" fill={brand} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Huni */}
            <div
              className="rounded-2xl p-6 flex flex-col"
              style={{ background: "#fff", border: "1px solid #E3E6EA" }}
            >
              <h2 className="text-sm font-semibold mb-4" style={{ color: "#14181F" }}>
                Kullanım Hunisi
              </h2>
              <FunnelViz funnel={data.funnel} brand={brand} />
            </div>
          </div>

          {/* En Çok Dinlenenler */}
          <div className="rounded-2xl p-6" style={{ background: "#fff", border: "1px solid #E3E6EA" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#14181F" }}>
              En Çok Dinlenen Kitaplar
            </h2>
            {data.topBooks.length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ color: "#9EA6B3" }}>
                Bu dönemde veri yok.
              </p>
            ) : (
              <div className="space-y-3">
                {data.topBooks.map((book, i) => (
                  <div key={book.bookId} className="flex items-center gap-4">
                    <span
                      className="w-6 text-center text-xs font-semibold flex-shrink-0"
                      style={{ color: i === 0 ? brand : "#9EA6B3" }}
                    >
                      {i + 1}
                    </span>
                    {book.coverUrl ? (
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-lg flex-shrink-0"
                        style={{ background: brand + "18" }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "#14181F" }}>
                        {book.title}
                      </div>
                      <div className="text-xs truncate" style={{ color: "#9EA6B3" }}>
                        {book.author}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold" style={{ color: "#14181F" }}>
                        {fmtHours(book.listenedSec)}
                      </div>
                      <div className="text-xs" style={{ color: "#9EA6B3" }}>
                        {book.listenerCount} dinleyici
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
  brand,
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  brand: string;
  extra?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col"
      style={{ background: "#fff", border: "1px solid #E3E6EA" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "#5A6270" }}>
          {label}
        </span>
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: brand + "14", color: brand }}
        >
          {icon}
        </span>
      </div>
      <div className="text-2xl font-semibold" style={{ color: "#14181F", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      <div className="text-xs mt-0.5" style={{ color: "#9EA6B3" }}>
        {sub}
      </div>
      {extra}
    </div>
  );
}

function FunnelViz({
  funnel,
  brand,
}: {
  funnel: { seats: number; hasPlayed: number; completed: number };
  brand: string;
}) {
  const max = Math.max(funnel.seats, 1);
  const steps = [
    { label: "Erişim (Koltuk)", value: funnel.seats, pct: 100 },
    { label: "En az 1 dinleme", value: funnel.hasPlayed, pct: Math.round((funnel.hasPlayed / max) * 100) },
    { label: "Kitap tamamladı", value: funnel.completed, pct: Math.round((funnel.completed / max) * 100) },
  ];
  return (
    <div className="flex flex-col gap-3 flex-1 justify-center">
      {steps.map((s, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: "#5A6270" }}>{s.label}</span>
            <span className="font-medium" style={{ color: "#14181F" }}>
              {s.value}
            </span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#F0F2F5" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${s.pct}%`, background: brand, opacity: 1 - i * 0.25 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
