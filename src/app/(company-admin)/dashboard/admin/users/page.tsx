"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users,
  UserCheck,
  UserX,
  Mail,
  ShieldCheck,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Check,
  X,
} from "lucide-react";

// ─── Tipler ───────────────────────────────────────────────────────────────────
type UserItem = {
  id: string;
  email: string;
  name: string | null;
  role: "EMPLOYEE" | "COMPANY_ADMIN";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

type InviteItem = {
  id: string;
  email: string;
  role: "EMPLOYEE" | "COMPANY_ADMIN";
  expiresAt: string;
  createdAt: string;
};

type TabCounts = { all: number; active: number; inactive: number; pending: number; admins: number };

type PageData =
  | { type: "user"; tab: string; total: number; page: number; pageSize: number; items: UserItem[] }
  | { type: "invite"; tab: string; total: number; page: number; pageSize: number; items: InviteItem[] };

// ─── Yardımcı ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 25;

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

function roleTR(role: string) {
  return role === "COMPANY_ADMIN" ? "Yönetici" : "Çalışan";
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
        <div style={{ position: "absolute", right: 0, top: "100%", background: "#fff", border: "1px solid #E3E6EA", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.12)", zIndex: 50, minWidth: 180, padding: "4px 0" }}>
          {/* Rol değiştir */}
          <button
            onClick={() => { onAction(isAdmin ? "demote" : "promote", item.id); setOpen(false); }}
            style={{ width: "100%", textAlign: "left", padding: "9px 14px", background: "none", border: "none", fontSize: 14, color: "#3A414C", cursor: "pointer" }}
          >
            {isAdmin ? "Çalışan yap" : "Yönetici yap"}
          </button>
          {/* Durum değiştir */}
          {!isSelf && (
            <button
              onClick={() => { onAction(item.isActive ? "deactivate" : "activate", item.id); setOpen(false); }}
              style={{ width: "100%", textAlign: "left", padding: "9px 14px", background: "none", border: "none", fontSize: 14, color: "#3A414C", cursor: "pointer" }}
            >
              {item.isActive ? "Pasife al" : "Etkinleştir"}
            </button>
          )}
          {/* Sil */}
          {!isSelf && (
            <button
              onClick={() => { onAction("delete", item.id); setOpen(false); }}
              style={{ width: "100%", textAlign: "left", padding: "9px 14px", background: "none", border: "none", fontSize: 14, color: "#DC2626", cursor: "pointer" }}
            >
              Kullanıcıyı sil
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ana sayfa ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [tab, setTab] = useState<"all" | "active" | "inactive" | "pending" | "admins">("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageData | null>(null);
  const [counts, setCounts] = useState<TabCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showInvite, setShowInvite] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Oturumdaki kullanıcıyı al
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
    setLoading(true);
    setSelected(new Set());
    try {
      const res = await fetch(`/api/dashboard/admin/users?tab=${tab}&page=${page}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { setPage(1); }, [tab]);
  useEffect(() => { loadData(); }, [loadData]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleAction(action: string, userId: string) {
    if (action === "delete") {
      setConfirmDelete(userId);
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

  async function confirmAndDelete(userId: string) {
    setConfirmDelete(null);
    const res = await fetch(`/api/dashboard/admin/users/${userId}`, { method: "DELETE" });
    const d = await res.json();
    if (res.ok) { showToast("Kullanıcı silindi."); loadData(); loadCounts(); }
    else showToast(d.error ?? "Silinemedi.", false);
  }

  async function handleBulk(action: "activate" | "deactivate") {
    if (selected.size === 0) return;
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

  const TABS: { key: typeof tab; label: string; icon: React.ReactNode; countKey: keyof TabCounts }[] = [
    { key: "all",      label: "Tümü",            icon: <Users size={14} />,      countKey: "all" },
    { key: "active",   label: "Aktif",            icon: <UserCheck size={14} />,  countKey: "active" },
    { key: "inactive", label: "Pasif",            icon: <UserX size={14} />,      countKey: "inactive" },
    { key: "pending",  label: "Davet Bekleniyor", icon: <Mail size={14} />,       countKey: "pending" },
    { key: "admins",   label: "Yöneticiler",      icon: <ShieldCheck size={14} />, countKey: "admins" },
  ];

  const brand = "#1E5AA8";

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Başlık */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#14181F" }}>Kullanıcılar</h1>
          {counts && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9EA6B3" }}>
              {counts.all} kayıtlı kullanıcı · {counts.pending} bekleyen davet
            </p>
          )}
        </div>
        <button
          onClick={() => setShowInvite(true)}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: brand, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          <UserPlus size={16} />
          Davet Gönder
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
              onClick={() => setTab(t.key)}
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

      {/* Toplu seçim araç çubuğu */}
      {selected.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: brand + "0f", border: `1px solid ${brand}30`, borderRadius: 8, marginTop: 12 }}>
          <span style={{ fontSize: 13, color: brand, fontWeight: 600 }}>{selected.size} seçildi</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => handleBulk("activate")} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${brand}`, background: "#fff", color: brand, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Etkinleştir
          </button>
          <button onClick={() => handleBulk("deactivate")} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #DC2626", background: "#fff", color: "#DC2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Pasife al
          </button>
          <button onClick={() => setSelected(new Set())} style={{ background: "none", border: "none", cursor: "pointer", color: "#9EA6B3" }}>
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
                <th style={thStyle}>E-posta</th>
                <th style={thStyle}>Rol</th>
                <th style={thStyle}>Gönderilme</th>
                <th style={thStyle}>Son Geçerlilik</th>
              </tr>
            </thead>
            <tbody>
              {inviteItems.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: "36px 16px", textAlign: "center", color: "#9EA6B3" }}>Bekleyen davet yok.</td></tr>
              ) : (
                inviteItems.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid #F0F2F5" }}>
                    <td style={tdStyle}>
                      <span style={{ color: "#14181F" }}>{inv.email}</span>
                    </td>
                    <td style={tdStyle}>
                      <RoleBadge role={inv.role} />
                    </td>
                    <td style={{ ...tdStyle, color: "#9EA6B3" }}>{fmtDate(inv.createdAt)}</td>
                    <td style={{ ...tdStyle, color: "#9EA6B3" }}>{fmtDate(inv.expiresAt)}</td>
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
                <th style={thStyle}>Ad / E-posta</th>
                <th style={thStyle}>Rol</th>
                <th style={thStyle}>Durum</th>
                <th style={thStyle}>Son Giriş</th>
                <th style={thStyle}>Katılım</th>
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
                      <div style={{ fontWeight: 500, color: "#14181F" }}>{u.name || "—"}</div>
                      <div style={{ color: "#9EA6B3", fontSize: 12 }}>{u.email}</div>
                    </td>
                    <td style={tdStyle}><RoleBadge role={u.role} /></td>
                    <td style={tdStyle}><StatusBadge active={u.isActive} /></td>
                    <td style={{ ...tdStyle, color: "#9EA6B3" }}>{fmtDate(u.lastLoginAt)}</td>
                    <td style={{ ...tdStyle, color: "#9EA6B3" }}>{fmtDate(u.createdAt)}</td>
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

      {/* Silme onayı */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: "100%", maxWidth: 380, boxShadow: "0 8px 32px rgba(0,0,0,.18)" }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700, color: "#14181F" }}>Kullanıcıyı sil?</h2>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#5A6270", lineHeight: 1.5 }}>Bu işlem geri alınamaz. Kullanıcının tüm verileri silinecek.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #D0D5DD", background: "#fff", fontSize: 14, cursor: "pointer" }}>İptal</button>
              <button onClick={() => confirmAndDelete(confirmDelete)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Sil</button>
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
      background: active ? "#F0FDF4" : "#FFF7ED",
      color: active ? "#15803D" : "#C2410C",
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
