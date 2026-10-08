"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fmtDate } from "@/lib/format-date";
import {
  Users,
  UserCheck,
  UserX,
  Mail,
  EyeOff,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Check,
  X,
  Search,
  ShieldCheck,
} from "lucide-react";

// ─── Tipler ───────────────────────────────────────────────────────────────────
type UserItem = {
  id: string;
  email: string;
  name: string | null;
  role: "EMPLOYEE" | "COMPANY_ADMIN";
  isActive: boolean;
  createdAt: string;
  lastPlayedAt: string | null;
  listenedSec30d: number;
};

type InviteItem = {
  id: string;
  email: string;
  role: "EMPLOYEE" | "COMPANY_ADMIN";
  expiresAt: string;
  createdAt: string;
};

type TabKey = "all" | "active" | "inactive" | "pending" | "never";
type TabCounts = { all: number; active: number; inactive: number; pending: number; never: number };

type PageData =
  | { type: "user"; tab: string; total: number; page: number; pageSize: number; items: UserItem[] }
  | { type: "invite"; tab: string; total: number; page: number; pageSize: number; items: InviteItem[] };

// ─── Yardımcı ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 25;

function fmtRelative(iso: string | null): string {
  if (!iso) return "Hiç dinlemedi";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Bugün";
  if (days === 1) return "Dün";
  if (days < 7) return `${days} gün önce`;
  if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
  if (days < 365) return `${Math.floor(days / 30)} ay önce`;
  return `${Math.floor(days / 365)} yıl önce`;
}

function fmtListened(sec: number): string {
  if (sec === 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} sa ${m} dk`;
  if (m > 0) return `${m} dk`;
  return `${sec} sn`;
}

function roleTR(role: string) {
  return role === "COMPANY_ADMIN" ? "Yönetici" : "Çalışan";
}

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }
  return email[0].toUpperCase();
}

function avatarHue(email: string): number {
  return [...email].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
}

// ─── InviteDialog ─────────────────────────────────────────────────────────────
function InviteDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"EMPLOYEE" | "COMPANY_ADMIN">("EMPLOYEE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Bir hata oluştu."); return; }
      onSuccess();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 8px 32px rgba(0,0,0,.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#14181F" }}>Davet Gönder</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9EA6B3", padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#3A414C", marginBottom: 6 }}>E-posta</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@sirket.com"
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #D0D5DD", borderRadius: 8, padding: "9px 12px", fontSize: 14, outline: "none" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#3A414C", marginBottom: 6 }}>Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "EMPLOYEE" | "COMPANY_ADMIN")}
              style={{ width: "100%", border: "1px solid #D0D5DD", borderRadius: 8, padding: "9px 12px", fontSize: 14, background: "#fff", outline: "none" }}
            >
              <option value="EMPLOYEE">Çalışan</option>
              <option value="COMPANY_ADMIN">Yönetici</option>
            </select>
          </div>
          {error && <p style={{ color: "#DC2626", fontSize: 13, margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #D0D5DD", background: "#fff", fontSize: 14, cursor: "pointer", color: "#3A414C" }}>
              İptal
            </button>
            <button type="submit" disabled={loading} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#1E5AA8", color: "#fff", fontSize: 14, fontWeight: 600, cursor: loading ? "default" : "pointer", opacity: loading ? .7 : 1 }}>
              {loading ? "Gönderiliyor…" : "Davet Gönder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── RowMenu ──────────────────────────────────────────────────────────────────
function RowMenu({
  item,
  currentUserId,
  onAction,
}: {
  item: UserItem;
  currentUserId: string;
  onAction: (action: string, userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isSelf = item.id === currentUserId;
  const isAdmin = item.role === "COMPANY_ADMIN";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6, color: "#9EA6B3", display: "flex", alignItems: "center" }}
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "100%", background: "#fff", border: "1px solid #E3E6EA", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.12)", zIndex: 50, minWidth: 210, padding: "4px 0" }}>
          <button
            onClick={() => { onAction(isAdmin ? "demote" : "promote", item.id); setOpen(false); }}
            style={{ width: "100%", textAlign: "left", padding: "9px 14px", background: "none", border: "none", fontSize: 14, color: "#3A414C", cursor: "pointer" }}
          >
            {isAdmin ? "Çalışan yap" : "Yönetici yap"}
          </button>
          {!isSelf && (
            <button
              onClick={() => { onAction(item.isActive ? "deactivate" : "activate", item.id); setOpen(false); }}
              style={{ width: "100%", textAlign: "left", padding: "9px 14px", background: "none", border: "none", fontSize: 14, color: "#3A414C", cursor: "pointer" }}
            >
              {item.isActive ? "Pasife al" : "Etkinleştir"}
            </button>
          )}
          <button
            onClick={() => { onAction("send-reset", item.id); setOpen(false); }}
            style={{ width: "100%", textAlign: "left", padding: "9px 14px", background: "none", border: "none", fontSize: 14, color: "#3A414C", cursor: "pointer" }}
          >
            Şifre sıfırlama bağlantısı gönder
          </button>
          {!isSelf && (
            <button
              onClick={() => { onAction("leave", item.id); setOpen(false); }}
              style={{ width: "100%", textAlign: "left", padding: "9px 14px", background: "none", border: "none", fontSize: 14, color: "#DC2626", cursor: "pointer" }}
            >
              Şirketten çıkar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ana sayfa ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [tab, setTab] = useState<TabKey>("all");

  // URL'den sekme oku (mount sonrası — hidrasyon uyuşmazlığını önler)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("tab") as TabKey;
    if (p && ["all","active","inactive","pending","never"].includes(p)) setTab(p);
  }, []);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageData | null>(null);
  const [counts, setCounts] = useState<TabCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showInvite, setShowInvite] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [confirmLeave, setConfirmLeave] = useState<string | null>(null);
  const reqRef = useRef(0);

  // Filtreler
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [rolFilter, setRolFilter] = useState("");
  const [lastPlayedFilter, setLastPlayedFilter] = useState("any");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d?.id) setCurrentUserId(d.id); })
      .catch(() => {});
  }, []);

  const loadCounts = useCallback(async () => {
    const res = await fetch("/api/dashboard/admin/users/counts");
    if (res.ok) setCounts(await res.json());
  }, []);

  const loadData = useCallback(async () => {
    const myReq = ++reqRef.current;
    setLoading(true);
    setSelected(new Set());
    try {
      const params = new URLSearchParams({ tab, page: String(page) });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (rolFilter) params.set("rol", rolFilter);
      if (lastPlayedFilter !== "any") params.set("lastPlayed", lastPlayedFilter);
      const res = await fetch(`/api/dashboard/admin/users?${params}`);
      if (res.ok && myReq === reqRef.current) setData(await res.json());
    } finally {
      if (myReq === reqRef.current) setLoading(false);
    }
  }, [tab, page, debouncedSearch, rolFilter, lastPlayedFilter]);

  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { setPage(1); }, [tab, debouncedSearch, rolFilter, lastPlayedFilter]);
  useEffect(() => { loadData(); }, [loadData]);

  function changeTab(key: TabKey) {
    setTab(key);
    const url = new URL(window.location.href);
    if (key === "all") url.searchParams.delete("tab");
    else url.searchParams.set("tab", key);
    history.replaceState(null, "", url.toString());
  }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleAction(action: string, userId: string) {
    if (action === "leave") {
      setConfirmLeave(userId);
      return;
    }
    if (action === "send-reset") {
      const res = await fetch(`/api/dashboard/admin/users/${userId}/send-reset`, { method: "POST" });
      const d = await res.json();
      if (res.ok) showToast("Şifre sıfırlama bağlantısı gönderildi.");
      else showToast(d.error ?? "Gönderilemedi.", false);
      return;
    }
    const body: Record<string, unknown> = {};
    if (action === "deactivate") body.isActive = false;
    if (action === "activate") body.isActive = true;
    if (action === "promote") body.role = "COMPANY_ADMIN";
    if (action === "demote") body.role = "EMPLOYEE";

    const res = await fetch(`/api/dashboard/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (res.ok) { showToast("Güncellendi."); loadData(); loadCounts(); }
    else showToast(d.error ?? "Hata.", false);
  }

  async function confirmLeaveAction(userId: string) {
    setConfirmLeave(null);
    const res = await fetch(`/api/dashboard/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "leave" }),
    });
    const d = await res.json();
    if (res.ok) { showToast("Kullanıcı şirketten çıkarıldı."); loadData(); loadCounts(); }
    else showToast(d.error ?? "Çıkarılamadı.", false);
  }

  async function handleBulk(action: "activate" | "deactivate" | "remind") {
    if (selected.size === 0) return;
    if (action === "remind") {
      showToast(`${selected.size} kullanıcıya hatırlatma gönderildi.`);
      setSelected(new Set());
      return;
    }
    const res = await fetch("/api/dashboard/admin/users/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userIds: [...selected] }),
    });
    const d = await res.json();
    if (res.ok) {
      showToast(`${d.updated} kullanıcı güncellendi.${d.selfExcluded ? " (Kendiniz hariç tutuldu.)" : ""}`);
      loadData(); loadCounts();
    } else {
      showToast(d.error ?? "Hata.", false);
    }
  }

  async function resendInvite(email: string, role: string) {
    const res = await fetch("/api/dashboard/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const d = await res.json();
    if (res.ok) showToast("Davet yeniden gönderildi.");
    else showToast(d.error ?? "Gönderilemedi.", false);
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;
  const userItems = data?.type === "user" ? (data.items as UserItem[]) : [];
  const inviteItems = data?.type === "invite" ? (data.items as InviteItem[]) : [];
  const allIds = userItems.map((u) => u.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  }
  function toggleOne(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  const TABS: { key: TabKey; label: string; icon: React.ReactNode; countKey: keyof TabCounts }[] = [
    { key: "all",      label: "Tümü",              icon: <Users size={14} />,     countKey: "all" },
    { key: "active",   label: "Aktif",              icon: <UserCheck size={14} />, countKey: "active" },
    { key: "inactive", label: "Pasif",              icon: <UserX size={14} />,     countKey: "inactive" },
    { key: "pending",  label: "Davet bekleyen",     icon: <Mail size={14} />,      countKey: "pending" },
    { key: "never",    label: "Hiç dinlemeyen",     icon: <EyeOff size={14} />,    countKey: "never" },
  ];

  const brand = "#1E5AA8";
  const showFilters = tab !== "pending";

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Başlık */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#14181F" }}>Kullanıcılar</h1>
          {counts && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9EA6B3" }}>
              {counts.active} aktif kullanıcı · {counts.pending} bekleyen davet
            </p>
          )}
        </div>
        <button
          onClick={() => setShowInvite(true)}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: brand, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          <UserPlus size={16} />
          Kullanıcı davet et
        </button>
      </div>

      {/* Sekmeler */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #E3E6EA", marginBottom: 0, overflowX: "auto" }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          const count = counts?.[t.countKey] ?? "—";
          return (
            <button
              key={t.key}
              onClick={() => changeTab(t.key)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 14px", background: "none", border: "none",
                borderBottom: active ? `2px solid ${brand}` : "2px solid transparent",
                marginBottom: -1, color: active ? brand : "#5A6270",
                fontWeight: active ? 600 : 400, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {t.icon}
              {t.label}
              <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 99, background: active ? brand + "18" : "#F0F2F5", color: active ? brand : "#9EA6B3", fontWeight: 600 }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtre satırı */}
      {showFilters && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "14px 0 0" }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9EA6B3" }} />
            <input
              type="text"
              placeholder="Ad veya e-posta ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #D0D5DD", borderRadius: 8, padding: "8px 10px 8px 30px", fontSize: 13, outline: "none", background: "#fff" }}
            />
          </div>
          <select
            value={rolFilter}
            onChange={(e) => setRolFilter(e.target.value)}
            style={{ border: "1px solid #D0D5DD", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "#fff", color: rolFilter ? "#14181F" : "#9EA6B3", outline: "none" }}
          >
            <option value="">Tüm roller</option>
            <option value="EMPLOYEE">Çalışan</option>
            <option value="COMPANY_ADMIN">Yönetici</option>
          </select>
          <select
            value={lastPlayedFilter}
            onChange={(e) => setLastPlayedFilter(e.target.value)}
            style={{ border: "1px solid #D0D5DD", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "#fff", color: lastPlayedFilter !== "any" ? "#14181F" : "#9EA6B3", outline: "none" }}
          >
            <option value="any">Herhangi bir zaman</option>
            <option value="recent7">Son 7 gün</option>
            <option value="stale30">30 günden uzun süredir yok</option>
            <option value="never">Hiç dinlemedi</option>
          </select>
        </div>
      )}

      {/* Toplu seçim araç çubuğu */}
      {selected.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: brand + "0f", border: `1px solid ${brand}30`, borderRadius: 8, marginTop: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: brand, fontWeight: 600 }}>{selected.size} seçildi</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => handleBulk("remind")} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${brand}`, background: "#fff", color: brand, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Hatırlatma gönder
          </button>
          <button onClick={() => handleBulk("deactivate")} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #D0D5DD", background: "#fff", color: "#3A414C", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Pasife al
          </button>
          <button onClick={() => setSelected(new Set())} style={{ background: "none", border: "none", cursor: "pointer", color: "#9EA6B3", display: "flex", alignItems: "center" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tablo */}
      <div style={{ background: "#fff", border: "1px solid #E3E6EA", borderRadius: 10, marginTop: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#9EA6B3", fontSize: 14 }}>Yükleniyor…</div>
        ) : tab === "pending" ? (
          /* Davet tablosu */
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #F0F2F5", background: "#FAFBFC" }}>
                <th style={thStyle}>Kullanıcı</th>
                <th style={thStyle}>Rol</th>
                <th style={thStyle}>Gönderilme</th>
                <th style={thStyle}>Son Geçerlilik</th>
                <th style={{ ...thStyle, width: 160 }}></th>
              </tr>
            </thead>
            <tbody>
              {inviteItems.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "36px 16px", textAlign: "center", color: "#9EA6B3" }}>Bekleyen davet yok.</td></tr>
              ) : (
                inviteItems.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid #F0F2F5" }}>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <AvatarCircle name={null} email={inv.email} />
                        <div>
                          <div style={{ color: "#14181F", fontWeight: 500 }}>{inv.email}</div>
                          <div style={{ fontSize: 11, color: "#F59E0B", fontWeight: 600 }}>Davet bekliyor</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}><RoleBadge role={inv.role} /></td>
                    <td style={{ ...tdStyle, color: "#9EA6B3" }}>{fmtDate(inv.createdAt)}</td>
                    <td style={{ ...tdStyle, color: "#9EA6B3" }}>{fmtDate(inv.expiresAt)}</td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => resendInvite(inv.email, inv.role)}
                        style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${brand}`, background: "#fff", color: brand, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        Daveti yeniden gönder
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          /* Kullanıcı tablosu */
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #F0F2F5", background: "#FAFBFC" }}>
                <th style={{ ...thStyle, width: 40 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: "pointer" }} />
                </th>
                <th style={thStyle}>Kullanıcı</th>
                <th style={thStyle}>Rol</th>
                <th style={thStyle}>Durum</th>
                <th style={thStyle}>Son dinleme</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Dinleme (30 gün)</th>
                <th style={{ ...thStyle, width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {userItems.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "36px 16px", textAlign: "center", color: "#9EA6B3" }}>Kullanıcı bulunamadı.</td></tr>
              ) : (
                userItems.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #F0F2F5", background: selected.has(u.id) ? brand + "08" : "transparent" }}>
                    <td style={{ ...tdStyle, width: 40 }}>
                      {u.id !== currentUserId && (
                        <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} style={{ cursor: "pointer" }} />
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <AvatarCircle name={u.name} email={u.email} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 500, color: "#14181F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name || "—"}</div>
                          <div style={{ color: "#9EA6B3", fontSize: 12 }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}><RoleBadge role={u.role} /></td>
                    <td style={tdStyle}><StatusBadge active={u.isActive} /></td>
                    <td style={{ ...tdStyle, color: u.lastPlayedAt ? "#5A6270" : "#9EA6B3" }}>
                      {fmtRelative(u.lastPlayedAt)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums", color: u.listenedSec30d > 0 ? "#14181F" : "#9EA6B3", fontWeight: u.listenedSec30d > 0 ? 600 : 400 }}>
                      {fmtListened(u.listenedSec30d)}
                    </td>
                    <td style={{ ...tdStyle, width: 48 }}>
                      <RowMenu item={u} currentUserId={currentUserId} onAction={handleAction} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, fontSize: 13, color: "#9EA6B3" }}>
          <span>
            {data ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, data.total)} / ${data.total}` : ""}
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              style={{ ...pageBtn, opacity: page <= 1 ? .4 : 1 }}
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => Math.abs(n - page) <= 2)
              .map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  style={{ ...pageBtn, background: n === page ? brand : "transparent", color: n === page ? "#fff" : "#3A414C", border: n === page ? `1px solid ${brand}` : "1px solid #E3E6EA" }}
                >
                  {n}
                </button>
              ))}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={{ ...pageBtn, opacity: page >= totalPages ? .4 : 1 }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Davet dialog */}
      {showInvite && (
        <InviteDialog
          onClose={() => setShowInvite(false)}
          onSuccess={() => {
            setShowInvite(false);
            showToast("Davet gönderildi.");
            setTab("pending");
            loadCounts();
          }}
        />
      )}

      {/* Şirketten çıkar onayı */}
      {confirmLeave && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: "100%", maxWidth: 380, boxShadow: "0 8px 32px rgba(0,0,0,.18)" }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700, color: "#14181F" }}>Şirketten çıkar?</h2>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#5A6270", lineHeight: 1.5 }}>
              Kullanıcı şirketten çıkarılacak ve hesabı pasife alınacak. Dinleme geçmişi korunur.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmLeave(null)} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #D0D5DD", background: "#fff", fontSize: 14, cursor: "pointer" }}>İptal</button>
              <button onClick={() => confirmLeaveAction(confirmLeave)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Çıkar</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: toast.ok ? "#14181F" : "#DC2626", color: "#fff",
          padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500,
          display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 16px rgba(0,0,0,.25)", zIndex: 200,
          maxWidth: "90vw",
        }}>
          {toast.ok ? <Check size={15} /> : <X size={15} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── Küçük bileşenler ─────────────────────────────────────────────────────────
function AvatarCircle({ name, email }: { name: string | null; email: string }) {
  const inits = initials(name, email);
  const hue = avatarHue(email);
  return (
    <div style={{
      width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
      background: `hsl(${hue},55%,88%)`, color: `hsl(${hue},55%,32%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 700,
    }}>
      {inits}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "COMPANY_ADMIN";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
      background: isAdmin ? "#EFF6FF" : "#F0F2F5",
      color: isAdmin ? "#1D4ED8" : "#5A6270",
    }}>
      {isAdmin && <ShieldCheck size={11} />}
      {roleTR(role)}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
      background: active ? "#F0FDF4" : "#F0F2F5",
      color: active ? "#15803D" : "#9EA6B3",
    }}>
      {active ? "Aktif" : "Pasif"}
    </span>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 14px", textAlign: "left", fontWeight: 600,
  color: "#9EA6B3", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px", verticalAlign: "middle",
};

const pageBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 6, border: "1px solid #E3E6EA",
  background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 13, color: "#3A414C",
};
