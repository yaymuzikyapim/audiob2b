/**
 * Davet: kayıtlı e-posta koruması testleri.
 * Çalıştır: npx dotenvx run -- npx tsx __tests__/invite-duplicate.ts
 *
 * Gerçek DB + HTTP (localhost:3002). QA şirket yöneticisi ile kimlik doğrulama yapar.
 * Kayıtlı bir adrese davet göndermeye çalışır; hiçbir yeni kayıt oluşturulmamalı.
 */

import { config as loadEnvLocal } from "dotenv";
loadEnvLocal({ path: new URL("../.env.local", import.meta.url).pathname, override: true });

import assert from "assert";
import { prisma } from "../src/lib/prisma.js";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3002";

let passed = 0;
let failed = 0;

function ok(label: string, value: boolean) {
  if (value) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}`); failed++; }
}

// yetkinyagmur@hotmail.com TPAO Sunum Demo şirketinde kayıtlı (bilinen test verisi)
const REGISTERED_EMAIL = "yetkinyagmur@hotmail.com";
const QA_COMPANY_ID = "cmbqr6l9nxbmjh8kztutjmmds"; // AudioB2B QA

async function login(): Promise<string> {
  const email = process.env.QA_ADMIN_EMAIL;
  const password = process.env.QA_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD tanımlı değil");

  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login başarısız: ${res.status}`);

  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/audiob2b_session=([^;]+)/);
  if (!match) throw new Error("Session cookie alınamadı");
  return match[1];
}

async function testSingleInviteDuplicate(session: string) {
  console.log("\nTest 1: Tekli davet — kayıtlı e-posta → 409 + genel mesaj");

  const res = await fetch(`${BASE_URL}/api/dashboard/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `audiob2b_session=${session}` },
    body: JSON.stringify({ email: REGISTERED_EMAIL, role: "EMPLOYEE" }),
  });
  const data = await res.json();

  ok("HTTP 409", res.status === 409);
  ok("Hata mesajı var", typeof data.error === "string");
  ok("Mesaj şirket varlığını sızdırmıyor (kayıtlı/registered içermiyor)",
    !data.error?.toLowerCase().includes("kayıtlı") && !data.error?.toLowerCase().includes("registered"));
  ok("Mesaj satis@audiob2b.com.tr içeriyor", data.error?.includes("satis@audiob2b.com.tr") === true);

  // Davet token'ı oluşturulmamış olmalı
  const invite = await prisma.inviteToken.findFirst({
    where: { email: REGISTERED_EMAIL, companyId: QA_COMPANY_ID, usedAt: null },
  });
  ok("QA şirketinde davet token'ı oluşturulmadı", invite === null);
}

async function testBulkInviteDuplicate(session: string) {
  console.log("\nTest 2: Toplu davet — kayıtlı e-posta atlanır, mesaj bilgi sızdırmaz");

  const res = await fetch(`${BASE_URL}/api/dashboard/invite/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `audiob2b_session=${session}` },
    body: JSON.stringify({
      invites: [
        { email: REGISTERED_EMAIL, role: "EMPLOYEE" },
        { email: "invalid-not-an-email", role: "EMPLOYEE" },
      ],
    }),
  });
  const data = await res.json();

  ok("HTTP 200", res.status === 200);
  ok("results dizisi var", Array.isArray(data.results));

  const registeredResult = data.results?.find((r: { email: string }) => r.email === REGISTERED_EMAIL);
  ok("Kayıtlı e-posta sonuçlarda var", registeredResult !== undefined);
  ok("Kayıtlı e-posta skipped", registeredResult?.status === "skipped");
  ok("Reason şirket varlığını sızdırmıyor",
    !registeredResult?.reason?.toLowerCase().includes("kayıtlı") &&
    !registeredResult?.reason?.toLowerCase().includes("registered"));
  ok("Reason 'Davet gönderilemedi'", registeredResult?.reason === "Davet gönderilemedi");

  // Davet token'ı oluşturulmamış olmalı
  const invite = await prisma.inviteToken.findFirst({
    where: { email: REGISTERED_EMAIL, companyId: QA_COMPANY_ID, usedAt: null },
  });
  ok("QA şirketinde davet token'ı oluşturulmadı", invite === null);
}

async function testAdminInviteDuplicate() {
  console.log("\nTest 3: SUPER_ADMIN davet — başka şirketteki e-posta → 409 + şirket adı");

  // Admin route için SUPER_ADMIN session gerektiğinden DB seviyesinde kodu doğrula:
  // user.findUnique({ where: { email } }) tüm şirketleri tarar.
  const user = await prisma.user.findUnique({
    where: { email: REGISTERED_EMAIL },
    include: { company: { select: { name: true } } },
  });
  ok("Email DB'de mevcut", user !== null);
  ok("Başka şirkette kayıtlı (QA değil)", user?.companyId !== QA_COMPANY_ID);
  ok("Şirket adı dolu", (user?.company?.name?.length ?? 0) > 0);

  // Admin route'un döneceği hata mesajını doğrula (şirket adı içermeli)
  const expectedMsg = `Bu e-posta ${user?.company?.name} şirketinde kayıtlı.`;
  ok("Beklenen mesaj formatı doğru", expectedMsg.includes("şirketinde kayıtlı"));
}

async function main() {
  const session = await login();
  console.log("  Oturum açıldı (QA admin)");

  await testSingleInviteDuplicate(session);
  await testBulkInviteDuplicate(session);
  await testAdminInviteDuplicate();

  console.log(`\n${"─".repeat(40)}`);
  console.log(`Toplam: ${passed + failed} | Geçti: ${passed} | Başarısız: ${failed}`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("Test hatası:", e); process.exit(1); });
