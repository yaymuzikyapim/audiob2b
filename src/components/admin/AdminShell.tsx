"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  BarChart2,
  Library,
  ChevronRight,
  LogOut,
  Headphones,
  Menu,
  X,
} from "lucide-react";

interface AdminShellProps {
  brandColor: string;
  companyName: string;
  logoUrl: string | null;
  userName: string | null;
  userEmail: string;
  children: React.ReactNode;
}

const NAV = [
  { href: "/dashboard/admin", label: "Genel Bakış", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/admin/users", label: "Kullanıcılar", icon: Users },
  { href: "/dashboard/admin/reports", label: "Raporlar", icon: BarChart2 },
  { href: "/dashboard/admin/library", label: "Kütüphane", icon: Library, soon: true },
];

const SIDEBAR_W = 260;

export default function AdminShell({
  brandColor,
  companyName,
  logoUrl,
  userName,
  userEmail,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const brand = brandColor || "#1E5AA8";

  // Sayfa değişince mobil menüyü kapat
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  // Menü açıkken body kaydırmayı engelle
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const navContent = (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", background: "#FFFFFF" }}
    >
      {/* Logo */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 24px", borderBottom: "1px solid #E3E6EA", minHeight: 72 }}
      >
        {logoUrl ? (
          <img src={logoUrl} alt={companyName} style={{ maxHeight: 32, maxWidth: 130, objectFit: "contain" }} />
        ) : (
          <span style={{ fontWeight: 600, fontSize: 14, color: "#14181F", lineHeight: 1.3 }}>{companyName}</span>
        )}
        <span
          style={{ marginLeft: "auto", fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 999, background: brand + "18", color: brand, flexShrink: 0 }}
        >
          Yönetici
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.soon ? "#" : item.href}
              onClick={item.soon ? (e) => e.preventDefault() : undefined}
              aria-disabled={item.soon}
              style={{
                display: "flex", alignItems: "center", gap: 12, minHeight: 44, padding: "0 12px",
                borderRadius: 8, textDecoration: "none", fontWeight: active ? 600 : 500, fontSize: 14,
                color: item.soon ? "#9EA6B3" : active ? brand : "#3A414C",
                background: active ? brand + "14" : "transparent",
                transition: "background .12s, color .12s",
              }}
            >
              <Icon size={20} strokeWidth={1.8} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.soon && (
                <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#F0F2F5", color: "#9EA6B3" }}>
                  Yakında
                </span>
              )}
              {active && !item.soon && <ChevronRight size={14} />}
            </Link>
          );
        })}
      </nav>

      {/* Dinlemeye dön */}
      <div style={{ padding: "0 16px 8px" }}>
        <Link
          href="/dashboard"
          style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 12px", borderRadius: 8, textDecoration: "none", fontSize: 14, color: "#5A6270" }}
        >
          <Headphones size={16} strokeWidth={1.8} />
          Dinlemeye dön
        </Link>
      </div>

      {/* Kullanıcı */}
      <div style={{ padding: 16, borderTop: "1px solid #E3E6EA" }}>
        <div style={{ padding: "8px 12px 4px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#14181F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userName || "Kullanıcı"}
          </div>
          <div style={{ fontSize: 12, color: "#9EA6B3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userEmail}
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 12px", borderRadius: 8, border: "none", background: "transparent", fontSize: 14, fontWeight: 500, color: "#5A6270", cursor: "pointer", textAlign: "left" }}
        >
          <LogOut size={15} strokeWidth={1.8} />
          Çıkış Yap
        </button>
      </div>
    </div>
  );

  return (
    <div data-theme="company-admin" style={{ fontFamily: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif", minHeight: "100vh", display: "flex", background: "#F4F5F7" }}>
      {/* ── Masaüstü sidebar (≥768px) ── */}
      <aside
        className="admin-sidebar-desktop"
        style={{
          position: "fixed", top: 0, left: 0, height: "100%", width: SIDEBAR_W,
          borderRight: "1px solid #E3E6EA", zIndex: 20,
          display: "flex", flexDirection: "column",
        }}
      >
        {navContent}
      </aside>

      {/* ── Mobil üst bar (<768px) ── */}
      <div
        className="admin-topbar-mobile"
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 20,
          height: 56, background: "#FFFFFF", borderBottom: "1px solid #E3E6EA",
          display: "flex", alignItems: "center", padding: "0 16px", gap: 12,
        }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Menüyü aç"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 8, color: "#14181F", display: "flex", alignItems: "center" }}
        >
          <Menu size={22} />
        </button>
        {logoUrl ? (
          <img src={logoUrl} alt={companyName} style={{ maxHeight: 28, maxWidth: 100, objectFit: "contain" }} />
        ) : (
          <span style={{ fontWeight: 600, fontSize: 14, color: "#14181F" }}>{companyName}</span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 999, background: brand + "18", color: brand }}>
          Yönetici
        </span>
      </div>

      {/* ── Mobil drawer overlay ── */}
      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 30 }}
          />
          <div
            style={{
              position: "fixed", top: 0, left: 0, bottom: 0, width: SIDEBAR_W,
              background: "#FFFFFF", zIndex: 40,
              animation: "slideInLeft .2s ease",
            }}
          >
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Menüyü kapat"
              style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: "#5A6270" }}
            >
              <X size={22} />
            </button>
            {navContent}
          </div>
        </>
      )}

      {/* ── Ana içerik ── */}
      <main
        className="admin-main"
        style={{ flex: 1, minHeight: "100vh", background: "#F4F5F7" }}
      >
        {children}
      </main>

      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }
        /* Masaüstü: sidebar görünür, topbar gizli, main sol boşluk */
        @media (min-width: 768px) {
          .admin-sidebar-desktop { display: flex !important; }
          .admin-topbar-mobile   { display: none !important; }
          .admin-main            { margin-left: ${SIDEBAR_W}px; margin-top: 0; }
        }
        /* Mobil: sidebar gizli, topbar görünür, main üst boşluk */
        @media (max-width: 767px) {
          .admin-sidebar-desktop { display: none !important; }
          .admin-topbar-mobile   { display: flex !important; }
          .admin-main            { margin-left: 0; margin-top: 56px; }
        }
      `}</style>
    </div>
  );
}
