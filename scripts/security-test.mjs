/**
 * AudioB2B Güvenlik Test Scripti — Test A/B/C/D
 *
 * Kullanım: node scripts/security-test.mjs
 *
 * Gereksinimler:
 *   - Next.js sunucusu http://localhost:3000 üzerinde çalışıyor olmalı
 *   - .env ve .env.local dosyaları proje kökünde bulunmalı
 *   - TEST_USER_EMAIL ve TEST_USER_PASSWORD .env.local içinde tanımlı olmalı
 *
 * Güvenlik kuralı: şifreler, token'lar ve kimlik bilgileri hiçbir çıktıya yazılmaz.
 *
 * Testler:
 *   A — Pasif COMPANY_ADMIN geçerli cookie ile dashboard route'larına erişemez (401 ACCOUNT_INACTIVE)
 *   B — Aktif test hesabıyla normal akış çalışır (200)
 *   C — 1 boş koltukta eşzamanlı iki davet → yalnızca biri başarılı (TOCTOU kilidi)
 *   D — Pasif SUPER_ADMIN geçerli cookie ile admin route'larına erişemez (401 ACCOUNT_INACTIVE)
 */

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

function readEnv(filePath) {
  const vars = {};
  if (!fs.existsSync(filePath)) return vars;
  for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return vars;
}

const env = {
  ...readEnv(path.join(PROJECT_ROOT, ".env")),
  ...readEnv(path.join(PROJECT_ROOT, ".env.local")),
};

if (!env.DATABASE_URL) throw new Error("DATABASE_URL bulunamadı (.env)");
if (!env.TEST_USER_EMAIL) throw new Error("TEST_USER_EMAIL bulunamadı (.env.local)");
if (!env.TEST_USER_PASSWORD) throw new Error("TEST_USER_PASSWORD bulunamadı (.env.local)");

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** HTTP isteği — Set-Cookie header dahil */
function request(urlPath, method = "GET", body = null, cookie = null) {
  return new Promise((resolve) => {
    const url = new URL(urlPath, BASE);
    const opts = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    };
    const req = http.request(url, opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        const setCookie = res.headers["set-cookie"];
        let sessionCookie = null;
        if (setCookie) {
          const match = setCookie.join(";").match(/audiob2b_session=([^;]+)/);
          if (match) sessionCookie = `audiob2b_session=${match[1]}`;
        }
        try {
          resolve({ status: res.statusCode, body: JSON.parse(d), sessionCookie });
        } catch {
          resolve({ status: res.statusCode, body: d, sessionCookie });
        }
      });
    });
    req.on("error", (e) => resolve({ status: 0, error: e.message, sessionCookie: null }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/** Aktif kullanıcı oluştur ve login endpoint'i aracılığıyla gerçek session cookie al */
async function createAndLogin(data) {
  const plainPass = randomBytes(16).toString("hex"); // hiçbir yerde yazdırılmaz
  const hashedPass = await bcrypt.hash(plainPass, 10);
  const user = await prisma.user.create({
    data: { ...data, password: hashedPass, isActive: true },
  });
  const loginRes = await request("/api/auth/login", "POST", {
    email: user.email,
    password: plainPass,
  });
  if (loginRes.status !== 200 || !loginRes.sessionCookie) {
    throw new Error(`Login başarısız: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
  }
  return { user, cookie: loginRes.sessionCookie };
}

const results = [];
const cleanupUserIds = [];
const cleanupInviteEmails = [];
let testCompanyId = null;
let savedMaxSeats = null;

async function main() {
  const company = await prisma.company.findFirst({
    where: { isActive: true },
    select: { id: true, name: true, maxSeats: true },
  });
  if (!company) throw new Error("Aktif şirket bulunamadı");
  testCompanyId = company.id;

  // ── TEST A: Pasif COMPANY_ADMIN ────────────────────────────────────────────
  console.log("→ Test A...");
  const { user: caUser, cookie: cookieA } = await createAndLogin({
    email: `test-a-ca-${Date.now()}@test-sec.internal`,
    name: "Test Pasif CA",
    role: "COMPANY_ADMIN",
    companyId: company.id,
  });
  cleanupUserIds.push(caUser.id);
  await prisma.user.update({ where: { id: caUser.id }, data: { isActive: false } });

  for (const [label, method, urlPath, body] of [
    ["A1 — Pasif CA → GET /team", "GET", "/api/dashboard/team", null],
    ["A2 — Pasif CA → POST /invite", "POST", "/api/dashboard/invite", { email: "x@x.x", role: "EMPLOYEE" }],
    ["A3 — Pasif CA → PATCH /member", "PATCH", "/api/dashboard/member", { userId: "x", action: "toggle_active" }],
  ]) {
    const res = await request(urlPath, method, body, cookieA);
    results.push({
      test: label,
      expected: "401 ACCOUNT_INACTIVE",
      actual: `${res.status} code=${res.body?.code ?? "yok"}`,
      pass: res.status === 401 && res.body?.code === "ACCOUNT_INACTIVE",
    });
  }

  // ── TEST B: Normal akış (test hesabı) ─────────────────────────────────────
  console.log("→ Test B...");
  const testUser = await prisma.user.findUnique({
    where: { email: env.TEST_USER_EMAIL },
    select: { id: true, role: true, isActive: true },
  });
  if (testUser?.isActive) {
    const loginB = await request("/api/auth/login", "POST", {
      email: env.TEST_USER_EMAIL,
      password: env.TEST_USER_PASSWORD,
    });
    if (loginB.status === 200 && loginB.sessionCookie) {
      const bPath = testUser.role === "SUPER_ADMIN" ? "/api/admin/stats" : "/api/dashboard/library";
      const b = await request(bPath, "GET", null, loginB.sessionCookie);
      results.push({
        test: `B — Normal akış (${testUser.role} → ${bPath})`,
        expected: "200",
        actual: `${b.status}`,
        pass: b.status === 200,
      });
    } else {
      results.push({ test: "B — Normal akış", expected: "200", actual: `Login ${loginB.status}`, pass: false });
    }
  } else {
    results.push({ test: "B — Normal akış", expected: "200", actual: "SKIP", pass: false });
  }

  // ── TEST C: TOCTOU — 1 boş koltukta eşzamanlı iki davet ──────────────────
  console.log("→ Test C...");
  const { user: caC, cookie: cookieC } = await createAndLogin({
    email: `test-c-ca-${Date.now()}@test-sec.internal`,
    name: "Test CA C",
    role: "COMPANY_ADMIN",
    companyId: company.id,
  });
  cleanupUserIds.push(caC.id);

  const [activeCount, pendingCount] = await Promise.all([
    prisma.user.count({ where: { companyId: company.id, isActive: true } }),
    prisma.inviteToken.count({
      where: { companyId: company.id, usedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);
  savedMaxSeats = company.maxSeats;
  await prisma.company.update({
    where: { id: company.id },
    data: { maxSeats: activeCount + pendingCount + 1 },
  });

  const ts = Date.now();
  const [em1, em2] = [`test-c1-${ts}@test-sec.internal`, `test-c2-${ts}@test-sec.internal`];
  cleanupInviteEmails.push(em1, em2);

  const [c1, c2] = await Promise.all([
    request("/api/dashboard/invite", "POST", { email: em1, role: "EMPLOYEE" }, cookieC),
    request("/api/dashboard/invite", "POST", { email: em2, role: "EMPLOYEE" }, cookieC),
  ]);
  const ok200 = [c1, c2].filter((r) => r.status === 200).length;
  const err400 = [c1, c2].filter((r) => r.status === 400).length;
  results.push({
    test: "C — Eşzamanlı 2 davet, 1 boş koltuk",
    expected: "1×200 + 1×400(SEATS_FULL)",
    actual: `${ok200}×200, ${err400}×400 [c1:${c1.status} c2:${c2.status}]`,
    pass: ok200 === 1 && err400 === 1,
  });

  await prisma.company.update({ where: { id: company.id }, data: { maxSeats: savedMaxSeats } });
  savedMaxSeats = null;

  // ── TEST D: Pasif SUPER_ADMIN ──────────────────────────────────────────────
  console.log("→ Test D...");
  const { user: saUser, cookie: cookieD } = await createAndLogin({
    email: `test-d-sa-${Date.now()}@test-sec.internal`,
    name: "Test Pasif SA",
    role: "SUPER_ADMIN",
  });
  cleanupUserIds.push(saUser.id);
  await prisma.user.update({ where: { id: saUser.id }, data: { isActive: false } });

  const d = await request("/api/admin/stats", "GET", null, cookieD);
  results.push({
    test: "D — Pasif SUPER_ADMIN → GET /admin/stats",
    expected: "401 ACCOUNT_INACTIVE",
    actual: `${d.status} code=${d.body?.code ?? "yok"}`,
    pass: d.status === 401 && d.body?.code === "ACCOUNT_INACTIVE",
  });
}

async function cleanup() {
  console.log("\n→ Temizlik...");
  if (savedMaxSeats !== null && testCompanyId) {
    await prisma.company.update({ where: { id: testCompanyId }, data: { maxSeats: savedMaxSeats } });
  }
  if (cleanupInviteEmails.length) {
    const r = await prisma.inviteToken.deleteMany({ where: { email: { in: cleanupInviteEmails } } });
    console.log(`  Davetler silindi: ${r.count}`);
  }
  if (cleanupUserIds.length) {
    const r = await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    console.log(`  Kullanıcılar silindi: ${r.count}`);
  }
  await prisma.$disconnect();
}

main()
  .then(async () => {
    await cleanup();
    const col = [52, 30, 40];
    const pad = (s, n) => String(s).slice(0, n).padEnd(n);
    console.log(`\n${"─".repeat(col[0] + col[1] + col[2] + 10)}`);
    console.log(`${pad("TEST", col[0])} ${pad("BEKLENEN", col[1])} ${pad("GERÇEKLEŞEN", col[2])} DURUM`);
    console.log(`${"─".repeat(col[0] + col[1] + col[2] + 10)}`);
    for (const r of results) {
      console.log(`${pad(r.test, col[0])} ${pad(r.expected, col[1])} ${pad(r.actual, col[2])} ${r.pass ? "✅" : "❌"}`);
    }
    const passed = results.filter((r) => r.pass).length;
    console.log(`${"─".repeat(col[0] + col[1] + col[2] + 10)}`);
    console.log(`Toplam: ${passed}/${results.length}\n`);
  })
  .catch(async (err) => {
    console.error("[HATA]", err.message);
    await cleanup().catch(() => {});
    process.exit(1);
  });
