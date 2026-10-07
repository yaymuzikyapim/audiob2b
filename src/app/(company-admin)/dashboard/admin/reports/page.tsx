"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
} from "recharts";

type PeriodKey = "30d" | "quarter" | "year" | "custom";
type ViewKey = "books" | "users";

interface Summary { totalListenedSec: number; activeListeners: number; distinctBooks: number; completedBooks: number; }
interface DailyPoint { date: string; listeners: number; weekend: boolean; }
interface BookRow { bookId: string; title: string; author: string; totalDurationSec: number; listeners: number; listenedSec: number; completedCount: number; completedPct: number; avgProgress: number; }
interface UserRow { userId: string; name: string | null; email: string; listenedSec: number; distinctBooks: number; lastPlayedAt: string; avgProgress: number; }
interface ReportData {
  period: string; from: string; to: string;
  company: { name: string; brandColor: string | null; maxSeats: number; endDate: string; } | null;
  summary: Summary;
  dailyChart: DailyPoint[];
  books: BookRow[];
  users: UserRow[];
  firstChapterDate: string | null;
  firstV2Date: string | null;
}

const PERIOD_LABELS: Record<PeriodKey, string> = { "30d": "Son 30 gün", quarter: "Bu çeyrek", year: "Bu yıl", custom: "Özel aralık" };
const TR_MONTHS = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];

function secToHms(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0 && m > 0) return `${h}sa ${m}dk`;
  if (h > 0) return `${h}sa`;
  if (m > 0) return `${m}dk`;
  return `${sec}sn`;
}

function fmtDateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${TR_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function fmtDateFull(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR");
}

function fmtXTick(date: string, prev: string | null): string {
  const m = date.slice(5, 7);
  if (!prev || prev.slice(5, 7) !== m) return `${TR_MONTHS[parseInt(m) - 1]} ${date.slice(8, 10)}`;
  return date.slice(8, 10);
}

// Aggregate chart for readability (max 90 bars)
function aggregateChart(points: DailyPoint[], maxBars = 90) {
  if (points.length <= maxBars) return points;
  const step = Math.ceil(points.length / maxBars);
  const result: DailyPoint[] = [];
  for (let i = 0; i < points.length; i += step) {
    const slice = points.slice(i, i + step);
    result.push({ date: slice[0].date, listeners: Math.max(...slice.map(d => d.listeners)), weekend: slice.every(d => d.weekend) });
  }
  return result;
}

interface ProgressBarProps { pct: number; count: number; }
function ProgressBar({ pct, count }: ProgressBarProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--border, #E3E6EA)" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: "var(--accent, #1A5DD9)", transition: "width .3s" }} />
      </div>
      <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 36, textAlign: "right" }}>{pct}% ({count})</span>
    </div>
  );
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [pendingFrom, setPendingFrom] = useState("");
  const [pendingTo, setPendingTo] = useState("");
  const [view, setView] = useState<ViewKey>("books");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dlState, setDlState] = useState<Record<string, boolean>>({});
  const reqRef = useRef(0);

  // Initialize from URL
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const pr = (p.get("period") ?? "30d") as PeriodKey;
    if (["30d","quarter","year","custom"].includes(pr)) setPeriod(pr);
    if (pr === "custom") {
      const f = p.get("from") ?? ""; const t = p.get("to") ?? "";
      setCustomFrom(f); setPendingFrom(f);
      setCustomTo(t); setPendingTo(t);
    }
    if (p.get("view") === "users") setView("users");
  }, []);

  const loadData = useCallback(async (pr: PeriodKey, cf: string, ct: string) => {
    const myReq = ++reqRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ period: pr });
      if (pr === "custom" && cf && ct) { params.set("from", cf); params.set("to", ct); }
      const res = await fetch(`/api/dashboard/admin/reports?${params}`);
      if (res.ok && myReq === reqRef.current) setData(await res.json());
    } finally {
      if (myReq === reqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (period !== "custom" || (customFrom && customTo)) {
      loadData(period, customFrom, customTo);
      // sync URL
      const url = new URL(window.location.href);
      url.searchParams.set("period", period);
      if (period === "custom" && customFrom && customTo) {
        url.searchParams.set("from", customFrom);
        url.searchParams.set("to", customTo);
      } else {
        url.searchParams.delete("from");
        url.searchParams.delete("to");
      }
      url.searchParams.set("view", view);
      history.replaceState(null, "", url.toString());
    }
  }, [period, customFrom, customTo, loadData]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    history.replaceState(null, "", url.toString());
  }, [view]);

  function applyCustom() {
    if (pendingFrom && pendingTo && pendingFrom <= pendingTo) {
      setCustomFrom(pendingFrom);
      setCustomTo(pendingTo);
    }
  }

  async function downloadFile(type: "excel" | "pdf") {
    setDlState(s => ({ ...s, [type]: true }));
    try {
      const params = new URLSearchParams({ period });
      if (period === "custom" && customFrom && customTo) { params.set("from", customFrom); params.set("to", customTo); }
      const res = await fetch(`/api/dashboard/admin/reports/${type}?${params}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `rapor.${type === "excel" ? "xlsx" : "pdf"}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDlState(s => ({ ...s, [type]: false }));
    }
  }

  const chartData = data ? aggregateChart(data.dailyChart) : [];

  const dateRangeLabel = data
    ? `${fmtDateShort(data.from)} – ${fmtDateShort(data.to)}`
    : "";

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text-primary, #14181F)" }}>Raporlar</h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--text-muted, #5A6270)" }}>Yönetime sunulabilir dinleme raporları</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => downloadFile("excel")}
            disabled={dlState.excel || loading || !data}
            style={{ padding: "8px 16px", fontSize: 13, fontWeight: 500, border: "1.5px solid var(--accent, #1A5DD9)", borderRadius: 8, background: "transparent", color: "var(--accent, #1A5DD9)", cursor: "pointer", opacity: (dlState.excel || loading) ? 0.6 : 1 }}
          >
            {dlState.excel ? "İndiriliyor…" : "Excel"}
          </button>
          <button
            onClick={() => downloadFile("pdf")}
            disabled={dlState.pdf || loading || !data}
            style={{ padding: "8px 16px", fontSize: 13, fontWeight: 500, border: "none", borderRadius: 8, background: "var(--accent, #1A5DD9)", color: "#fff", cursor: "pointer", opacity: (dlState.pdf || loading) ? 0.6 : 1 }}
          >
            {dlState.pdf ? "Oluşturuluyor…" : "PDF rapor"}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--border, #E3E6EA)", borderRadius: 10, padding: "12px 16px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {/* Period pills */}
          <div style={{ display: "flex", gap: 4 }}>
            {(Object.entries(PERIOD_LABELS) as [PeriodKey, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setPeriod(k)}
                style={{
                  padding: "5px 12px", fontSize: 13, borderRadius: 20, border: "1.5px solid",
                  borderColor: period === k ? "var(--accent, #1A5DD9)" : "var(--border, #E3E6EA)",
                  background: period === k ? "var(--accent, #1A5DD9)" : "transparent",
                  color: period === k ? "#fff" : "var(--text-primary, #14181F)",
                  cursor: "pointer", fontWeight: period === k ? 600 : 400,
                }}
              >{label}</button>
            ))}
          </div>
          {/* View toggle */}
          <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
            {(["books", "users"] as ViewKey[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: "5px 12px", fontSize: 13, borderRadius: 6, border: "1.5px solid",
                  borderColor: view === v ? "var(--accent, #1A5DD9)" : "var(--border, #E3E6EA)",
                  background: view === v ? "color-mix(in srgb, var(--accent, #1A5DD9) 10%, transparent)" : "transparent",
                  color: view === v ? "var(--accent, #1A5DD9)" : "var(--text-muted, #5A6270)",
                  cursor: "pointer", fontWeight: view === v ? 600 : 400,
                }}
              >{v === "books" ? "Kitap bazında" : "Kullanıcı bazında"}</button>
            ))}
          </div>
          {/* Date range label */}
          {dateRangeLabel && (
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted, #5A6270)" }}>{dateRangeLabel}</span>
          )}
        </div>
        {/* Custom date inputs */}
        {period === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <label style={{ fontSize: 12, color: "var(--text-muted, #5A6270)" }}>Başlangıç</label>
            <input type="date" value={pendingFrom} onChange={e => setPendingFrom(e.target.value)}
              style={{ padding: "4px 8px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border, #E3E6EA)", background: "var(--card-bg, #fff)" }} />
            <label style={{ fontSize: 12, color: "var(--text-muted, #5A6270)" }}>Bitiş</label>
            <input type="date" value={pendingTo} onChange={e => setPendingTo(e.target.value)}
              style={{ padding: "4px 8px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border, #E3E6EA)", background: "var(--card-bg, #fff)" }} />
            <button
              onClick={applyCustom}
              disabled={!pendingFrom || !pendingTo || pendingFrom > pendingTo}
              style={{ padding: "4px 14px", fontSize: 13, borderRadius: 6, background: "var(--accent, #1A5DD9)", color: "#fff", border: "none", cursor: "pointer", opacity: (!pendingFrom || !pendingTo || pendingFrom > pendingTo) ? 0.5 : 1 }}
            >Uygula</button>
          </div>
        )}
      </div>

      {loading && !data && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted, #5A6270)" }}>Yükleniyor…</div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Toplam dinleme", value: secToHms(data.summary.totalListenedSec) },
              { label: "Aktif dinleyici", value: data.summary.activeListeners },
              { label: "Dinlenen farklı kitap", value: data.summary.distinctBooks },
              { label: "Tamamlanan kitap", value: data.summary.completedBooks },
            ].map(card => (
              <div key={card.label} style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--border, #E3E6EA)", borderRadius: 10, padding: "16px 18px" }}>
                <div style={{ fontSize: 12, color: "var(--text-muted, #5A6270)", marginBottom: 6 }}>{card.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary, #14181F)" }}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Daily chart */}
          {chartData.length > 0 && (
            <div style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--border, #E3E6EA)", borderRadius: 10, padding: "20px 20px 12px", marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary, #14181F)", marginBottom: 12 }}>Günlük Aktif Dinleyici</div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "var(--text-muted, #5A6270)" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      tickFormatter={(val, i) => fmtXTick(val, i > 0 ? chartData[i - 1]?.date : null)}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--text-muted, #5A6270)" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(v) => [`${v} kişi`, "Aktif dinleyici"]}
                      labelFormatter={(label) => fmtDateShort(String(label))}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border, #E3E6EA)" }}
                    />
                    <Bar dataKey="listeners" maxBarSize={40} radius={[3, 3, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.weekend ? "#A8C4F0" : "var(--accent, #1A5DD9)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Book table */}
          {view === "books" && (
            <div style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--border, #E3E6EA)", borderRadius: 10, overflow: "hidden", marginBottom: 24 }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border, #E3E6EA)", fontSize: 13, fontWeight: 600 }}>
                Kitap Bazında
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: "var(--text-muted, #5A6270)" }}>{data.books.length} kitap</span>
              </div>
              {data.books.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted, #5A6270)", fontSize: 13 }}>Bu dönemde dinleme kaydı bulunamadı.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--table-header-bg, #F5F7FA)" }}>
                      {["Kitap", "Dinleyen", "Toplam dinleme", "Tamamlayanlar", "Ort. ilerleme"].map(h => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: h === "Kitap" ? "left" : "right", fontSize: 11, fontWeight: 600, color: "var(--text-muted, #5A6270)", whiteSpace: "nowrap", borderBottom: "1px solid var(--border, #E3E6EA)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.books.map((b, i) => (
                      <tr key={b.bookId} style={{ borderBottom: "1px solid var(--border, #E3E6EA)", background: i % 2 === 0 ? "transparent" : "var(--row-alt-bg, #FAFBFC)" }}>
                        <td style={{ padding: "10px 16px", maxWidth: 300 }}>
                          <div style={{ fontWeight: 500, fontSize: 13, color: "var(--text-primary, #14181F)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</div>
                          {b.author && <div style={{ fontSize: 11, color: "var(--text-muted, #5A6270)", marginTop: 2 }}>{b.author}{b.totalDurationSec > 0 ? ` · ${secToHms(b.totalDurationSec)}` : ""}</div>}
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>{b.listeners}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, whiteSpace: "nowrap" }}>{secToHms(b.listenedSec)}</td>
                        <td style={{ padding: "10px 32px 10px 16px", minWidth: 160 }}>
                          <ProgressBar pct={b.completedPct} count={b.completedCount} />
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, whiteSpace: "nowrap" }}>%{b.avgProgress}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* User table */}
          {view === "users" && (
            <div style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--border, #E3E6EA)", borderRadius: 10, overflow: "hidden", marginBottom: 24 }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border, #E3E6EA)", fontSize: 13, fontWeight: 600 }}>
                Kullanıcı Bazında
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: "var(--text-muted, #5A6270)" }}>{data.users.length} kullanıcı</span>
              </div>
              {data.users.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted, #5A6270)", fontSize: 13 }}>Bu dönemde dinleme kaydı bulunamadı.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--table-header-bg, #F5F7FA)" }}>
                      {["Kullanıcı", "Dinleme süresi", "Kitap sayısı", "Son dinleme", "Ort. ilerleme"].map(h => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: h === "Kullanıcı" ? "left" : "right", fontSize: 11, fontWeight: 600, color: "var(--text-muted, #5A6270)", whiteSpace: "nowrap", borderBottom: "1px solid var(--border, #E3E6EA)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((u, i) => (
                      <tr key={u.userId} style={{ borderBottom: "1px solid var(--border, #E3E6EA)", background: i % 2 === 0 ? "transparent" : "var(--row-alt-bg, #FAFBFC)" }}>
                        <td style={{ padding: "10px 16px" }}>
                          {u.name && <div style={{ fontWeight: 500, fontSize: 13, color: "var(--text-primary, #14181F)" }}>{u.name}</div>}
                          <div style={{ fontSize: 11, color: "var(--text-muted, #5A6270)", marginTop: u.name ? 2 : 0 }}>{u.email}</div>
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, whiteSpace: "nowrap" }}>{secToHms(u.listenedSec)}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13 }}>{u.distinctBooks}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, whiteSpace: "nowrap" }}>{fmtDateFull(u.lastPlayedAt)}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13 }}>%{u.avgProgress}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Footer notes */}
          <div style={{ fontSize: 11, color: "var(--text-muted, #5A6270)", borderTop: "1px solid var(--border, #E3E6EA)", paddingTop: 12 }}>
            {data.firstChapterDate && (
              <p style={{ margin: "0 0 4px" }}>
                * <strong>Tamamlanan kitap:</strong> tüm bölümler %90 veya üzeri dinlendiğinde sayılır.
                {" "}{fmtDateShort(data.firstChapterDate)} tarihinden itibaren bölüm bazlı veri mevcuttur; önceki dinlemeler tamamlanma hesabına katılmaz.
              </p>
            )}
            {data.firstV2Date && (
              <p style={{ margin: "0 0 4px" }}>
                ** Tüm metrikler yalnızca güncel uygulama (v2+) verisini yansıtır.
                {" "}İlk kayıt: {fmtDateShort(data.firstV2Date)}.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
