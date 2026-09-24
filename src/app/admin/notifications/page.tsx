"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

interface Company { id: string; name: string; count: number; }
interface Book { id: string; title: string; author: string; coverUrl: string | null; }
interface LogEntry {
  id: string;
  sentAt: string;
  target: string;
  companyId: string | null;
  title: string;
  body: string;
  bookId: string | null;
  sent: number;
  failed: number;
  admin: { name: string | null; email: string };
}

type Step = "form" | "confirm";

export default function NotificationsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [target, setTarget] = useState<"all" | "company">("all");
  const [companyId, setCompanyId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // Kitap seçici
  const [bookQuery, setBookQuery] = useState("");
  const [bookResults, setBookResults] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookDropOpen, setBookDropOpen] = useState(false);
  const bookSearchRef = useRef<HTMLDivElement>(null);
  const bookTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Akış
  const [step, setStep] = useState<Step>("form");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Geçmiş
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    fetch("/api/admin/notifications?action=company-counts")
      .then((r) => r.json())
      .then((d) => setCompanies(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch("/api/admin/notifications?action=history")
      .then((r) => r.json())
      .then((d) => setLogs(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Kitap arama — debounce 300ms
  useEffect(() => {
    if (bookTimer.current) clearTimeout(bookTimer.current);
    if (!bookQuery.trim()) { setBookResults([]); return; }
    bookTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/books?q=${encodeURIComponent(bookQuery)}`);
        const data = await res.json();
        setBookResults(Array.isArray(data) ? data.slice(0, 8) : []);
        setBookDropOpen(true);
      } catch {}
    }, 300);
  }, [bookQuery]);

  // Kitap seçici dışına tıklama
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (bookSearchRef.current && !bookSearchRef.current.contains(e.target as Node)) {
        setBookDropOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function selectBook(book: Book) {
    setSelectedBook(book);
    setBookQuery(book.title);
    setBookDropOpen(false);
    setBookResults([]);
  }

  function clearBook() {
    setSelectedBook(null);
    setBookQuery("");
    setBookResults([]);
  }

  async function handleReview() {
    if (!title.trim() || !body.trim()) { setError("Başlık ve mesaj zorunlu."); return; }
    if (target === "company" && !companyId) { setError("Lütfen bir şirket seçin."); return; }
    setError(null);
    const params = new URLSearchParams({ target });
    if (target === "company" && companyId) params.set("companyId", companyId);
    try {
      const res = await fetch(`/api/admin/notifications?${params}`);
      const json = await res.json();
      setRecipientCount(json.count ?? 0);
      setStep("confirm");
    } catch { setError("Alıcı sayısı alınamadı."); }
  }

  const refreshHistory = useCallback(async () => {
    const res = await fetch("/api/admin/notifications?action=history").catch(() => null);
    if (res?.ok) { const d = await res.json(); setLogs(Array.isArray(d) ? d : []); }
  }, []);

  async function handleSend() {
    setSending(true); setResult(null); setError(null);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          data: selectedBook ? { bookId: selectedBook.id } : {},
          coverUrl: selectedBook?.coverUrl ?? undefined,
          target,
          ...(target === "company" ? { companyId } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Bir hata oluştu."); setStep("form"); return; }
      setResult({ sent: json.sent, failed: json.failed });
      setTitle(""); setBody(""); clearBook(); setStep("form");
      await refreshHistory();
    } catch { setError("Ağ hatası."); setStep("form"); }
    finally { setSending(false); }
  }

  const selectedCompany = companies.find((c) => c.id === companyId);

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-white">Bildirim Gönder</h1>

      {step === "confirm" ? (
        <ConfirmStep
          title={title}
          body={body}
          book={selectedBook}
          recipientCount={recipientCount}
          sending={sending}
          onBack={() => setStep("form")}
          onSend={handleSend}
        />
      ) : (
        <div className="bg-gray-900 rounded-xl p-6 space-y-5">
          {/* Hedef */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Hedef</label>
            <div className="flex gap-3">
              {(["all", "company"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTarget(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    target === t
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-white"
                  }`}
                >
                  {t === "all" ? "Tüm kullanıcılar" : "Şirkete göre"}
                </button>
              ))}
            </div>
          </div>

          {/* Şirket seçimi + kullanıcı sayısı */}
          {target === "company" && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Şirket</label>
              <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                {companies.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCompanyId(c.id)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                      companyId === c.id
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500"
                    }`}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.count > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-gray-700 text-gray-500"
                    }`}>
                      {c.count} alıcı
                    </span>
                  </button>
                ))}
                {companies.length === 0 && (
                  <p className="text-sm text-gray-500 py-2">Aktif şirket bulunamadı.</p>
                )}
              </div>
            </div>
          )}

          {/* Başlık */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Başlık</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bildirim başlığı"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          {/* Mesaj */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Mesaj</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Bildirim metni"
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          {/* Kitap seçici */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Kitap <span className="text-gray-600">(opsiyonel — tıklayınca açar, kapak görseli bildirimde görünür)</span>
            </label>
            <div ref={bookSearchRef} className="relative">
              {selectedBook ? (
                <div className="flex items-center gap-3 bg-gray-800 border border-emerald-500/40 rounded-lg px-3 py-2">
                  {selectedBook.coverUrl && (
                    <Image src={selectedBook.coverUrl} alt="" width={32} height={32} className="w-8 h-8 rounded object-cover flex-shrink-0" unoptimized />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{selectedBook.title}</p>
                    <p className="text-xs text-gray-400 truncate">{selectedBook.author}</p>
                  </div>
                  <button onClick={clearBook} className="text-gray-500 hover:text-gray-300 text-lg leading-none flex-shrink-0">×</button>
                </div>
              ) : (
                <input
                  type="text"
                  value={bookQuery}
                  onChange={(e) => { setBookQuery(e.target.value); setBookDropOpen(true); }}
                  onFocus={() => bookQuery && setBookDropOpen(true)}
                  placeholder="Kitap adıyla ara..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-emerald-500/60"
                />
              )}
              {bookDropOpen && bookResults.length > 0 && !selectedBook && (
                <div className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
                  {bookResults.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => selectBook(b)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700 transition-colors text-left"
                    >
                      {b.coverUrl ? (
                        <Image src={b.coverUrl} alt="" width={36} height={36} className="w-9 h-9 rounded object-cover flex-shrink-0" unoptimized />
                      ) : (
                        <div className="w-9 h-9 rounded bg-gray-700 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{b.title}</p>
                        <p className="text-xs text-gray-400 truncate">{b.author}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Önizleme */}
          {(title || body || selectedBook) && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Önizleme</p>
              <NotificationPreview title={title} body={body} book={selectedBook} />
            </div>
          )}

          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
          )}
          {result && (
            <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
              Gönderildi: <strong>{result.sent}</strong> &nbsp;|&nbsp; Başarısız: <strong>{result.failed}</strong>
            </div>
          )}

          <button
            onClick={handleReview}
            className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-colors"
          >
            İncele ve Gönder →
          </button>
        </div>
      )}

      {/* Gönderim geçmişi */}
      {logs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Son Gönderimlер</h2>
          <div className="space-y-2">
            {logs.map((log) => {
              const company = companies.find((c) => c.id === log.companyId);
              return (
                <div key={log.id} className="bg-gray-900 rounded-xl px-4 py-3 flex gap-4 items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{log.title}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{log.body}</p>
                    <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-gray-500">
                      <span>{new Date(log.sentAt).toLocaleString("tr-TR")}</span>
                      <span>·</span>
                      <span>{log.target === "company" ? (company?.name ?? log.companyId ?? "Şirket") : "Tüm kullanıcılar"}</span>
                      <span>·</span>
                      <span className="text-emerald-500">{log.sent} gönderildi</span>
                      {log.failed > 0 && <><span>·</span><span className="text-red-400">{log.failed} başarısız</span></>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationPreview({ title, body, book }: { title: string; body: string; book: Book | null }) {
  return (
    <div className="bg-gray-800 rounded-xl p-3 flex gap-3 items-start border border-gray-700">
      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0 text-lg">🎧</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{title || "Başlık"}</p>
        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{body || "Mesaj metni"}</p>
      </div>
      {book?.coverUrl && (
        <Image src={book.coverUrl} alt="" width={44} height={44} className="w-11 h-11 rounded-lg object-cover flex-shrink-0" unoptimized />
      )}
    </div>
  );
}

function ConfirmStep({
  title, body, book, recipientCount, sending, onBack, onSend,
}: {
  title: string; body: string; book: Book | null;
  recipientCount: number | null; sending: boolean;
  onBack: () => void; onSend: () => void;
}) {
  return (
    <div className="bg-gray-900 border border-amber-500/40 rounded-xl p-6 space-y-4">
      <p className="text-amber-400 font-semibold">Onay</p>
      <NotificationPreview title={title} body={body} book={book} />
      <p className="text-gray-300 text-sm">
        Bu bildirim{" "}
        <span className="font-bold text-white">{recipientCount ?? "?"}</span>{" "}
        aktif kullanıcıya gönderilecek. Emin misiniz?
      </p>
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-2.5 rounded-lg bg-gray-800 text-gray-300 hover:text-white text-sm font-medium transition-colors"
        >
          Geri Dön
        </button>
        <button
          onClick={onSend}
          disabled={sending}
          className="flex-1 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white font-semibold text-sm transition-colors"
        >
          {sending ? "Gönderiliyor…" : "Evet, Gönder"}
        </button>
      </div>
    </div>
  );
}
