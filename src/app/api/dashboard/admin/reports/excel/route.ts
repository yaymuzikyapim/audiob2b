import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { parsePeriod, computeReportData } from "@/lib/report-data";
import ExcelJS from "exceljs";
import { fmtDate } from "@/lib/format-date";

export const dynamic = "force-dynamic";

function secToHms(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}sa ${m}dk`;
  return `${m}dk`;
}

export async function GET(req: Request) {
  const auth = await requireUser({ roles: ["COMPANY_ADMIN"] });
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "30d";
  const { from, to } = parsePeriod(period, url.searchParams.get("from"), url.searchParams.get("to"));

  const data = await computeReportData(user.companyId!, from, to, period);

  const wb = new ExcelJS.Workbook();
  wb.creator = "AudioB2B";
  wb.created = new Date();

  const ACCENT = "003366";
  const HEADER_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + ACCENT } };
  const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };

  function applyHeader(row: ExcelJS.Row) {
    row.eachCell(cell => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
      cell.border = { bottom: { style: "thin", color: { argb: "FFFFFFFF" } } };
    });
    row.height = 22;
  }

  const dateRange = `${fmtDate(from)} – ${fmtDate(to)}`;

  // --- Özet sheet ---
  const ws1 = wb.addWorksheet("Özet");
  ws1.columns = [
    { header: "Metrik", key: "metric", width: 32 },
    { header: "Değer", key: "value", width: 20 },
  ];
  applyHeader(ws1.getRow(1));
  ws1.addRows([
    { metric: "Şirket", value: data.company?.name ?? "" },
    { metric: "Dönem", value: dateRange },
    { metric: "Toplam dinleme süresi", value: secToHms(data.summary.totalListenedSec) },
    { metric: "Aktif dinleyici sayısı", value: data.summary.activeListeners },
    { metric: "Dinlenen farklı kitap sayısı", value: data.summary.distinctBooks },
    { metric: "Tamamlanan kitap sayısı", value: data.summary.completedBooks },
  ]);

  // --- Kitap Bazında sheet ---
  const ws2 = wb.addWorksheet("Kitap Bazında");
  ws2.columns = [
    { header: "Kitap Adı", key: "title", width: 36 },
    { header: "Yazar", key: "author", width: 24 },
    { header: "Dinleyen Kişi", key: "listeners", width: 16 },
    { header: "Toplam Dinleme", key: "listenedSec", width: 18 },
    { header: "Tamamlayan Kişi", key: "completedCount", width: 18 },
    { header: "Tamamlanma %", key: "completedPct", width: 16 },
    { header: "Ort. İlerleme %", key: "avgProgress", width: 16 },
  ];
  applyHeader(ws2.getRow(1));
  for (const b of data.books) {
    ws2.addRow({
      title: b.title,
      author: b.author,
      listeners: b.listeners,
      listenedSec: secToHms(b.listenedSec),
      completedCount: b.completedCount,
      completedPct: b.completedPct,
      avgProgress: b.avgProgress,
    });
  }
  ws2.getRows(2, ws2.rowCount)?.forEach((row, i) => {
    row.getCell("completedPct").numFmt = '0"%"';
    row.getCell("avgProgress").numFmt = '0"%"';
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFF5F7FA" : "FFFFFFFF" } };
  });

  // --- Kullanıcı Bazında sheet ---
  const ws3 = wb.addWorksheet("Kullanıcı Bazında");
  ws3.columns = [
    { header: "Ad Soyad", key: "name", width: 24 },
    { header: "E-posta", key: "email", width: 32 },
    { header: "Toplam Dinleme", key: "listenedSec", width: 18 },
    { header: "Dinlenen Kitap", key: "distinctBooks", width: 16 },
    { header: "Son Dinleme", key: "lastPlayedAt", width: 20 },
    { header: "Ort. İlerleme %", key: "avgProgress", width: 16 },
  ];
  applyHeader(ws3.getRow(1));
  for (const u of data.users) {
    ws3.addRow({
      name: u.name ?? "",
      email: u.email,
      listenedSec: secToHms(u.listenedSec),
      distinctBooks: u.distinctBooks,
      lastPlayedAt: fmtDate(u.lastPlayedAt),
      avgProgress: u.avgProgress,
    });
  }
  ws3.getRows(2, ws3.rowCount)?.forEach((row, i) => {
    row.getCell("avgProgress").numFmt = '0"%"';
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFF5F7FA" : "FFFFFFFF" } };
  });

  const buf = await wb.xlsx.writeBuffer();
  const companySlug = (data.company?.name ?? "rapor").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const filename = `audiob2b-${companySlug}-${from.toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
