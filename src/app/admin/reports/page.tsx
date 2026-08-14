"use client";

import { useState, useEffect, useCallback } from "react";

function fmt(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

interface BookRow { bookId: string; title: string; author: string; listenedSec: number; userCount: number }
interface CompanyRow { companyId: string; name: string; listenedSec: number; topBook: string }
interface Report { bookReport: BookRow[]; companyReport: CompanyRow[]; year: number; month: number }

const MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/reports/listening?year=${year}&month=${month}`);
    const data = await res.json();
    setReport(data);
    setLoading(false);
  }, [year, month]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  function exportCSV() {
    if (!report) return;
    const rows: string[][] = [];

    rows.push([`AudioB2B Dinleme Raporu — ${MONTHS[month - 1]} ${year}`]);
    rows.push([]);
    rows.push(["ŞİRKET BAZLI"]);
    rows.push(["Şirket", "Toplam Dinleme", "En Çok Dinlenen Kitap"]);
    report.companyReport.forEach((r) => rows.push([r.name, fmt(r.listenedSec), r.topBook]));
    rows.push([]);
    rows.push(["KİTAP BAZLI"]);
    rows.push(["Kitap", "Yazar", "Toplam Dinleme", "Kullanıcı Sayısı"]);
    report.bookReport.forEach((r) => rows.push([r.title, r.author, fmt(r.listenedSec), String(r.userCount)]));

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audiob2b-rapor-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Dinleme Raporu</h1>
        <button onClick={exportCSV} disabled={!report || loading}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors">
          CSV İndir
        </button>
      </div>

      {/* Filtreler */}
      <div className="flex gap-3 mb-8">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
          className="px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading && <div className="text-gray-500 text-sm">Yükleniyor...</div>}

      {report && !loading && (
        <div className="space-y-6">
          {/* Şirket bazlı */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-white font-semibold">Şirket Bazlı ({report.companyReport.length})</h2>
            </div>
            {report.companyReport.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500 text-sm">Bu dönemde dinleme verisi yok.</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {report.companyReport.map((r) => (
                  <div key={r.companyId} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <div className="text-white text-sm font-medium">{r.name}</div>
                      <div className="text-gray-500 text-xs mt-0.5">En çok: {r.topBook}</div>
                    </div>
                    <div className="text-emerald-400 font-semibold text-sm">{fmt(r.listenedSec)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kitap bazlı */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-white font-semibold">Kitap Bazlı ({report.bookReport.length})</h2>
            </div>
            {report.bookReport.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500 text-sm">Bu dönemde dinleme verisi yok.</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {report.bookReport.map((r) => (
                  <div key={r.bookId} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <div className="text-white text-sm font-medium">{r.title}</div>
                      <div className="text-gray-500 text-xs mt-0.5">{r.author} · {r.userCount} kullanıcı</div>
                    </div>
                    <div className="text-emerald-400 font-semibold text-sm">{fmt(r.listenedSec)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
