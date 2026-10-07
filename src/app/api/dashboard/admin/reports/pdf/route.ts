import { NextResponse } from "next/server";
import path from "path";
import React from "react";
import {
  Document, Page, View, Text, Svg, Rect, Line,
  Font, StyleSheet, renderToBuffer,
} from "@react-pdf/renderer";
import { requireUser } from "@/lib/auth-guard";
import { parsePeriod, computeReportData, type ReportData, type DailyChartPoint } from "@/lib/report-data";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const FONT_DIR = path.join(process.cwd(), "src/assets/fonts");

Font.register({
  family: "IBM Plex Sans",
  fonts: [
    { src: path.join(FONT_DIR, "IBMPlexSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "IBMPlexSans-Medium.ttf"), fontWeight: 500 },
    { src: path.join(FONT_DIR, "IBMPlexSans-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "IBMPlexSans-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback(w => [w]);

const ACCENT = "#1A5DD9";
const GRAY = "#5A6270";
const BORDER = "#E3E6EA";
const BG_CARD = "#F5F7FA";

const s = StyleSheet.create({
  page:    { fontFamily: "IBM Plex Sans", fontSize: 9, color: "#14181F", paddingHorizontal: 40, paddingVertical: 40 },
  h1:      { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  h2:      { fontSize: 13, fontWeight: 600, marginBottom: 10 },
  subtext: { fontSize: 9, color: GRAY },
  row:     { flexDirection: "row" },
  card:    { flex: 1, border: `1 solid ${BORDER}`, borderRadius: 6, padding: 10, marginRight: 8, backgroundColor: BG_CARD },
  cardLast:{ flex: 1, border: `1 solid ${BORDER}`, borderRadius: 6, padding: 10, backgroundColor: BG_CARD },
  cardLabel:{ fontSize: 8, color: GRAY, marginBottom: 4 },
  cardValue:{ fontSize: 16, fontWeight: 700 },
  section: { marginTop: 20 },
  tRow:    { flexDirection: "row", borderBottom: `1 solid ${BORDER}`, paddingVertical: 5 },
  tHeader: { flexDirection: "row", borderBottom: `1 solid #9DA5B0}`, paddingVertical: 5, backgroundColor: BG_CARD },
  tCell:   { fontSize: 8.5 },
  tCellH:  { fontSize: 8.5, fontWeight: 600, color: GRAY },
  footer:  { marginTop: 20, paddingTop: 8, borderTop: `1 solid ${BORDER}` },
  footerText: { fontSize: 7.5, color: GRAY, marginBottom: 2 },
});

function secToHms(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}sa ${m}dk`;
  return `${m}dk`;
}

function fmtDate(iso: string): string {
  const months = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const d = new Date(iso);
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const CHART_W = 515;
const CHART_H = 90;
const NUM_BARS = 30;

function aggregateChart(chart: DailyChartPoint[], n = NUM_BARS) {
  if (chart.length === 0) return [];
  const step = Math.ceil(chart.length / n);
  const result: { label: string; listeners: number; weekend: boolean }[] = [];
  for (let i = 0; i < chart.length; i += step) {
    const slice = chart.slice(i, i + step);
    const maxListeners = Math.max(...slice.map(d => d.listeners));
    result.push({ label: slice[0].date.slice(5), listeners: maxListeners, weekend: slice.every(d => d.weekend) });
  }
  return result;
}

function ChartSvg({ chart }: { chart: DailyChartPoint[] }) {
  const bars = aggregateChart(chart);
  if (bars.length === 0) return null;
  const maxVal = Math.max(...bars.map(b => b.listeners), 1);
  const gap = 2;
  const barW = Math.max(1, (CHART_W - (bars.length - 1) * gap) / bars.length);

  return React.createElement(Svg, { width: CHART_W, height: CHART_H + 16, viewBox: `0 0 ${CHART_W} ${CHART_H + 16}` },
    ...bars.map((b, i) => {
      const bh = Math.max(1, Math.round((b.listeners / maxVal) * CHART_H));
      const x = i * (barW + gap);
      const y = CHART_H - bh;
      return React.createElement(Rect, {
        key: i, x, y, width: barW, height: bh,
        fill: b.weekend ? "#A8C4F0" : ACCENT,
        rx: 1,
      });
    }),
    // baseline
    React.createElement(Line, { x1: 0, y1: CHART_H, x2: CHART_W, y2: CHART_H, stroke: BORDER, strokeWidth: 1 }),
  );
}

function ReportDoc({ data }: { data: ReportData }) {
  const period = `${fmtDate(data.from)} – ${fmtDate(data.to)}`;
  const companyName = data.company?.name ?? "Rapor";

  const summaryCards = [
    { label: "Toplam dinleme",        value: secToHms(data.summary.totalListenedSec) },
    { label: "Aktif dinleyici",        value: String(data.summary.activeListeners) },
    { label: "Farklı kitap",           value: String(data.summary.distinctBooks) },
    { label: "Tamamlanan kitap",       value: String(data.summary.completedBooks) },
  ];

  return React.createElement(Document, { title: `${companyName} — Kullanım Raporu` },
    // Page 1: header + cards + chart + book table
    React.createElement(Page, { size: "A4", style: s.page },
      // header
      React.createElement(View, { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 } },
        React.createElement(View, null,
          React.createElement(Text, { style: s.h1 }, "Kullanım Raporu"),
          React.createElement(Text, { style: { fontSize: 11, color: GRAY, marginTop: 2 } }, companyName),
        ),
        React.createElement(Text, { style: { fontSize: 9, color: GRAY, marginTop: 6 } }, period),
      ),
      // summary cards
      React.createElement(View, { style: { flexDirection: "row", marginBottom: 20 } },
        ...summaryCards.map((c, i) =>
          React.createElement(View, { key: i, style: i < 3 ? s.card : s.cardLast },
            React.createElement(Text, { style: s.cardLabel }, c.label),
            React.createElement(Text, { style: s.cardValue }, c.value),
          )
        ),
      ),
      // daily chart
      React.createElement(View, { style: { marginBottom: 20 } },
        React.createElement(Text, { style: { ...s.h2, marginBottom: 6 } }, "Günlük Aktif Dinleyici"),
        React.createElement(ChartSvg, { chart: data.dailyChart }),
        React.createElement(Text, { style: { ...s.subtext, marginTop: 4, fontSize: 7.5 } }, "Hafta sonu çubukları açık mavi"),
      ),
      // book table
      React.createElement(View, { style: s.section },
        React.createElement(Text, { style: s.h2 }, "Kitap Bazında"),
        React.createElement(View, { style: s.tHeader },
          React.createElement(Text, { style: { ...s.tCellH, flex: 3 } }, "Kitap"),
          React.createElement(Text, { style: { ...s.tCellH, flex: 1, textAlign: "right" } }, "Dinleyen"),
          React.createElement(Text, { style: { ...s.tCellH, flex: 1.5, textAlign: "right" } }, "Toplam dinleme"),
          React.createElement(Text, { style: { ...s.tCellH, flex: 1, textAlign: "right" } }, "Tamam %"),
          React.createElement(Text, { style: { ...s.tCellH, flex: 1, textAlign: "right" } }, "Ort. %"),
        ),
        ...data.books.slice(0, 50).map((b, i) =>
          React.createElement(View, { key: i, style: { ...s.tRow, backgroundColor: i % 2 === 0 ? BG_CARD : "#FFFFFF" } },
            React.createElement(View, { style: { flex: 3 } },
              React.createElement(Text, { style: s.tCell }, b.title),
              React.createElement(Text, { style: { fontSize: 7.5, color: GRAY } }, b.author),
            ),
            React.createElement(Text, { style: { ...s.tCell, flex: 1, textAlign: "right" } }, String(b.listeners)),
            React.createElement(Text, { style: { ...s.tCell, flex: 1.5, textAlign: "right" } }, secToHms(b.listenedSec)),
            React.createElement(Text, { style: { ...s.tCell, flex: 1, textAlign: "right" } }, `%${b.completedPct}`),
            React.createElement(Text, { style: { ...s.tCell, flex: 1, textAlign: "right" } }, `%${b.avgProgress}`),
          )
        ),
        data.books.length > 50
          ? React.createElement(Text, { style: { ...s.subtext, marginTop: 6 } }, `İlk 50 kitap gösterilmektedir. Tam liste Excel dışa aktarımında mevcuttur.`)
          : null,
      ),
      // footer
      React.createElement(View, { style: s.footer },
        data.firstChapterDate
          ? React.createElement(Text, { style: s.footerText }, `* Tamamlanan kitap ve ortalama ilerleme, ${fmtDate(data.firstChapterDate)} tarihinden itibaren bölüm bazlı veride hesaplanmaktadır.`)
          : null,
        React.createElement(Text, { style: { ...s.footerText, marginTop: 2 } }, `Rapor oluşturma tarihi: ${new Date().toLocaleDateString("tr-TR")}`),
      ),
    ),
    // Page 2: user table
    data.users.length > 0
      ? React.createElement(Page, { size: "A4", style: s.page },
          React.createElement(Text, { style: s.h2 }, "Kullanıcı Bazında"),
          React.createElement(View, { style: s.tHeader },
            React.createElement(Text, { style: { ...s.tCellH, flex: 2 } }, "Ad Soyad"),
            React.createElement(Text, { style: { ...s.tCellH, flex: 1.5, textAlign: "right" } }, "Toplam dinleme"),
            React.createElement(Text, { style: { ...s.tCellH, flex: 1, textAlign: "right" } }, "Kitap"),
            React.createElement(Text, { style: { ...s.tCellH, flex: 1.5, textAlign: "right" } }, "Son dinleme"),
            React.createElement(Text, { style: { ...s.tCellH, flex: 1, textAlign: "right" } }, "Ort. %"),
          ),
          ...data.users.slice(0, 80).map((u, i) =>
            React.createElement(View, { key: i, style: { ...s.tRow, backgroundColor: i % 2 === 0 ? BG_CARD : "#FFFFFF" } },
              React.createElement(Text, { style: { ...s.tCell, flex: 2 } }, u.name ?? u.email.split("@")[0]),
              React.createElement(Text, { style: { ...s.tCell, flex: 1.5, textAlign: "right" } }, secToHms(u.listenedSec)),
              React.createElement(Text, { style: { ...s.tCell, flex: 1, textAlign: "right" } }, String(u.distinctBooks)),
              React.createElement(Text, { style: { ...s.tCell, flex: 1.5, textAlign: "right" } }, new Date(u.lastPlayedAt).toLocaleDateString("tr-TR")),
              React.createElement(Text, { style: { ...s.tCell, flex: 1, textAlign: "right" } }, `%${u.avgProgress}`),
            )
          ),
          data.users.length > 80
            ? React.createElement(Text, { style: { ...s.subtext, marginTop: 6 } }, `İlk 80 kullanıcı gösterilmektedir. Tam liste Excel dışa aktarımında mevcuttur.`)
            : null,
          React.createElement(View, { style: s.footer },
            data.firstChapterDate
              ? React.createElement(Text, { style: s.footerText }, `* Ortalama ilerleme, ${fmtDate(data.firstChapterDate)} tarihinden itibaren bölüm bazlı veride hesaplanmaktadır.`)
              : null,
          ),
        )
      : null,
  );
}

export async function GET(req: Request) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "30d";
  const { from, to } = parsePeriod(period, url.searchParams.get("from"), url.searchParams.get("to"));

  const data = await computeReportData(user.companyId!, from, to, period);

  // Turkish character test: ğ ş ı İ ç ö ü Ğ Ş Ç Ö Ü
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuf = await renderToBuffer(React.createElement(ReportDoc, { data }) as any);
  const companySlug = (data.company?.name ?? "rapor").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const filename = `audiob2b-${companySlug}-${from.toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
