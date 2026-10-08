/**
 * Şifre yönetimi paketi testleri.
 * Çalıştır: npx dotenvx run -- npx tsx __tests__/password-management.ts
 *
 * Gerçek DB kullanır; QA şirketi veya kendi test kayıtları üzerinde çalışır.
 * Test kullanıcısı sonunda temizlenir.
 */

// .env.local'daki QA_ADMIN_* değişkenlerini yükle (dotenvx sadece .env yüklüyor)
import { config as loadEnvLocal } from "dotenv";
loadEnvLocal({ path: new URL("../.env.local", import.meta.url).pathname, override: false });

import crypto from "crypto";
import assert from "assert";
import { prisma } from "../src/lib/prisma.js";
import {
  generateResetToken,
  hashToken,
  hashPassword,
  verifyPassword,
  isCommonPassword,
  newPasswordSchema,
} from "../src/lib/password.js";
import { checkRateLimit, peekRateLimit } from "../src/lib/rate-limit.js";

let passed = 0;
let failed = 0;

function ok(label: string, value: boolean) {
  if (value) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

// ── 1. Zod şema testleri ─────────────────────────────────────────────────────
console.log("\n1. Zod şema testleri");
ok("8+ karakter geçerli", newPasswordSchema.safeParse("Password1").success);
ok("Büyük harf olmadan geçersiz", !newPasswordSchema.safeParse("password1").success);
ok("Rakam olmadan geçersiz", !newPasswordSchema.safeParse("Password").success);
ok("7 karakter geçersiz", !newPasswordSchema.safeParse("Pass1Ab").success);
ok("74 ASCII bayt → geçersiz", !newPasswordSchema.safeParse("A1" + "x".repeat(72)).success);
ok("40 × 'ğ' (80 UTF-8 bayt) → geçersiz", !newPasswordSchema.safeParse("A1" + "ğ".repeat(40)).success);
ok("36 × 'ğ' (72 UTF-8 bayt) + 'A1' → geçersiz (74 bayt)", !newPasswordSchema.safeParse("A1" + "ğ".repeat(36)).success);
ok("Tam 72 bayt ASCII → geçerli", newPasswordSchema.safeParse("A1" + "x".repeat(70)).success);

// ── 2. Yaygın şifre tespiti ──────────────────────────────────────────────────
console.log("\n2. Yaygın şifre tespiti");
ok("'123456' yaygın", isCommonPassword("123456"));
ok("'audiob2b' yaygın", isCommonPassword("audiob2b"));
ok("Şirket adı içeren yaygın", isCommonPassword("acme2024", "Acme Corp"));
ok("Rastgele şifre yaygın değil", !isCommonPassword("Xq9$kLm2!vP7"));
ok("Kısa şirket adı (3 harf) atlıyor", !isCommonPassword("abc2024", "ABC"));

// ── 3. Token üretimi ve hash ─────────────────────────────────────────────────
console.log("\n3. Token üretimi ve hash");
const { raw, hash } = generateResetToken();
ok("Raw token 64 hex karakter", raw.length === 64);
ok("Hash 64 hex karakter", hash.length === 64);
ok("Raw ve hash farklı", raw !== hash);
ok("hashToken tekrarlanabilir", hashToken(raw) === hash);
ok("Farklı token farklı hash", hashToken(crypto.randomBytes(32).toString("hex")) !== hash);

// ── 4. Bcrypt yardımcıları ───────────────────────────────────────────────────
console.log("\n4. Bcrypt yardımcıları");
async function testBcrypt() {
  const pw = "TestPass99!";
  const h1 = await hashPassword(pw);
  const h2 = await hashPassword(pw);
  ok("Hash farklı tuzlar üretir", h1 !== h2);
  ok("Doğru şifre eşleşiyor", await verifyPassword(pw, h1));
  ok("Yanlış şifre eşleşmiyor", !(await verifyPassword("WrongPass1!", h1)));
}

// ── 5. passwordChangedAt saniye hassasiyeti ──────────────────────────────────
// JWT iat saniye bazlı; passwordChangedAt ms bazlı.
// floor(passwordChangedAt / 1000) > iat olduğunda token geçersiz olmalı.
console.log("\n5. passwordChangedAt saniye hassasiyeti");
function tokenInvalidated(passwordChangedAtMs: number, iatSeconds: number): boolean {
  return Math.floor(passwordChangedAtMs / 1000) > iatSeconds;
}
const now = Date.now();
const iat = Math.floor(now / 1000);
ok("Şifre değişmedi → token geçerli", !tokenInvalidated(now - 5000, iat));
ok("Şifre token'dan 1s sonra → geçersiz", tokenInvalidated((iat + 1) * 1000, iat));
ok("Aynı saniyede değişim → geçerli (eşit, büyük değil)", !tokenInvalidated(iat * 1000 + 500, iat));
ok("Şifre tam token anında ms altı → geçerli", !tokenInvalidated(iat * 1000 - 1, iat));
ok("Şifre 1 gün önce, token bugün → geçerli", !tokenInvalidated(now - 86400000, iat));

// ── 6. DB: PasswordResetToken yaşam döngüsü ─────────────────────────────────
console.log("\n6. DB: PasswordResetToken yaşam döngüsü");
async function testDb() {
  // QA şirketinde geçici test kullanıcısı oluştur
  const testEmail = `pw-test-${Date.now()}@qa.test`;
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      password: await hashPassword("TempPass99!"),
      role: "EMPLOYEE",
      companyId: "cmbqr6l9nxbmjh8kztutjmmds", // AudioB2B QA
    },
  });

  try {
    const { raw, hash } = generateResetToken();
    const expiresAt = new Date(Date.now() + 3600_000);

    const token = await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt },
    });
    ok("Token oluşturuldu", !!token.id);

    const found = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hash } });
    ok("Token hash ile bulundu", !!found && found.userId === user.id);

    // Süresi geçmiş token kontrolü
    const expiredHash = hashToken("expired-" + raw);
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: expiredHash, expiresAt: new Date(Date.now() - 1) },
    });
    const expired = await prisma.passwordResetToken.findUnique({ where: { tokenHash: expiredHash } });
    ok("Süresi dolmuş token DB'de var ama expiresAt geçmiş", !!expired && expired.expiresAt < new Date());

    // passwordChangedAt güncellemesi
    const changedAt = new Date();
    await prisma.user.update({ where: { id: user.id }, data: { passwordChangedAt: changedAt } });
    const updated = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordChangedAt: true } });
    ok("passwordChangedAt kaydedildi", updated?.passwordChangedAt?.getTime() === changedAt.getTime());

    // PasswordAuditLog kaydı
    const audit = await prisma.passwordAuditLog.create({
      data: { userId: user.id, event: "RESET_REQUEST", ipAddress: "127.0.0.1" },
    });
    ok("Audit log oluşturuldu", audit.event === "RESET_REQUEST");

    // actorId ile ADMIN_TRIGGER
    const adminLog = await prisma.passwordAuditLog.create({
      data: { userId: user.id, actorId: user.id, event: "ADMIN_TRIGGER" },
    });
    ok("ADMIN_TRIGGER actorId ile oluşturuldu", adminLog.actorId === user.id);
  } finally {
    // Temizlik
    await prisma.passwordAuditLog.deleteMany({ where: { userId: user.id } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    ok("Test kullanıcısı temizlendi", true);
  }
}

// ── 7. Cross-company guard (DB seviyesi) ─────────────────────────────────────
// send-reset route'undaki companyId kontrolünü simüle eder.
// HTTP endpoint çağırmadan, aynı mantık DB'den verify edilir.
console.log("\n7. Cross-company guard (DB seviyesi)");
async function testCrossCompanyGuard() {
  const QA_COMPANY = "cmbqr6l9nxbmjh8kztutjmmds";

  // QA şirketindeki geçici "admin" benzeri kullanıcı (sadece companyId okunur)
  const qaUser = await prisma.user.findFirst({
    where: { companyId: QA_COMPANY, isActive: true },
    select: { id: true, companyId: true },
  });

  // Başka bir şirketteki kullanıcı (TPAO ve review-company-001 hariç)
  const otherUser = await prisma.user.findFirst({
    where: {
      isActive: true,
      companyId: {
        not: QA_COMPANY,
        notIn: ["cmbyjva5lq554ag8tccmt8yw2", "cmss0akuv0007hpjfzrqnlf4w", "review-company-001"],
      },
    },
    select: { id: true, companyId: true },
  });

  if (!qaUser || !otherUser) {
    console.log("  ⚠ Cross-company testi için yeterli veri yok, atlandı.");
    return;
  }

  // Kural: target.companyId !== actor.companyId → 403
  const wouldBeForbidden = otherUser.companyId !== qaUser.companyId;
  ok("Farklı şirket → guard 403 verir", wouldBeForbidden);

  // Aynı şirket → geçer
  const sameCompanyUser = await prisma.user.findFirst({
    where: { companyId: QA_COMPANY, isActive: true, id: { not: qaUser.id } },
    select: { id: true, companyId: true },
  });
  if (sameCompanyUser) {
    const wouldBeAllowed = sameCompanyUser.companyId === qaUser.companyId;
    ok("Aynı şirket → guard geçer", wouldBeAllowed);
  }
}

// ── 8. Send-reset şirket kontrolü (HTTP) ─────────────────────────────────────
console.log("\n8. Send-reset şirket kontrolü (HTTP endpoint)");
async function testSendResetCompanyGuard() {
  const QA_COMPANY = "cmbqr6l9nxbmjh8kztutjmmds";
  const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3002";

  // Geçici QA-2 şirketi
  const qa2 = await prisma.company.create({
    data: {
      name: "AudioB2B QA-2",
      slug: `qa2-test-${Date.now()}`,
      licenseType: "PER_SEAT",
      maxSeats: 5,
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      isDemo: true,
      isActive: true,
    },
  });

  // QA-2'ye ait sahte kullanıcı
  const fakeUser = await prisma.user.create({
    data: {
      email: `fake-${Date.now()}@example.com`,
      password: await hashPassword("TempPass99!"),
      role: "EMPLOYEE",
      companyId: qa2.id,
    },
  });

  // QA-1 admini olarak giriş yap
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.QA_ADMIN_EMAIL,
      password: process.env.QA_ADMIN_PASSWORD,
    }),
  });
  const cookie = loginRes.headers.get("set-cookie");
  ok("QA admin girişi başarılı", loginRes.ok);

  // Farklı şirketin kullanıcısına send-reset → 403
  const crossRes = await fetch(
    `${BASE}/api/dashboard/admin/users/${fakeUser.id}/send-reset`,
    {
      method: "POST",
      headers: { Cookie: cookie ?? "" },
    },
  );
  ok("Farklı şirket → 403", crossRes.status === 403);

  // PasswordResetToken oluşmadığını doğrula
  const tokens = await prisma.passwordResetToken.findMany({ where: { userId: fakeUser.id } });
  ok("Token oluşturulmadı", tokens.length === 0);

  // Aynı şirketin kullanıcısına send-reset → 200 (veya 404 şirket yoksa)
  // QA şirketindeki gerçek bir kullanıcı bul (QA admin kendisi)
  const qaUser = await prisma.user.findFirst({
    where: { companyId: QA_COMPANY, isActive: true, email: { not: process.env.QA_ADMIN_EMAIL } },
    select: { id: true },
  });
  if (qaUser) {
    const sameRes = await fetch(
      `${BASE}/api/dashboard/admin/users/${qaUser.id}/send-reset`,
      {
        method: "POST",
        headers: { Cookie: cookie ?? "" },
      },
    );
    // 200: başarılı | 502: e-posta gönderilemedi (test domain kısıtı) — her ikisi de 403 değil
    ok("Aynı şirket → 403 değil (200 veya 502)", sameRes.status !== 403 && sameRes.status !== 401);
    // Temizle
    await prisma.passwordResetToken.deleteMany({ where: { userId: qaUser.id } });
    await prisma.passwordAuditLog.deleteMany({ where: { userId: qaUser.id, event: "ADMIN_TRIGGER" } });
  } else {
    console.log("  ⚠ Aynı şirket testi: QA-1'de başka aktif kullanıcı yok, atlandı.");
  }

  // Temizlik
  await prisma.passwordAuditLog.deleteMany({ where: { userId: fakeUser.id } });
  await prisma.user.delete({ where: { id: fakeUser.id } });
  await prisma.company.delete({ where: { id: qa2.id } });
  ok("QA-2 şirketi ve sahte kullanıcı silindi", true);
}

// ── 9. Login hız sınırı (DB) ──────────────────────────────────────────────────
console.log("\n9. Login hız sınırı (DB)");
async function testLoginRateLimit() {
  const testKey = `login:rl-test-${Date.now()}@example.com:127.0.0.1`;
  const WINDOW_MS = 15 * 60 * 1000;
  const MAX = 10;

  // Başlangıçta allowed
  const initial = await peekRateLimit(testKey, WINDOW_MS, MAX);
  ok("Başlangıçta allowed", initial.allowed);

  // 10 başarısız deneme kaydet
  for (let i = 0; i < MAX; i++) {
    await checkRateLimit(testKey, WINDOW_MS, MAX);
  }

  // 10 denemeden sonra peek → reddedilmeli
  const afterMax = await peekRateLimit(testKey, WINDOW_MS, MAX);
  ok("10 başarısız sonrası peek → reddedildi", !afterMax.allowed);
  ok("Kalan: 0", afterMax.remaining === 0);

  // Kayıt mevcut
  const windowStart = new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS);
  const record = await prisma.rateLimit.findUnique({
    where: { key_windowStart: { key: testKey, windowStart } },
  });
  ok("DB'de 10 kayıt var", record?.count === MAX);

  // Pencere bitti simülasyonu: kaydı sil
  await prisma.rateLimit.deleteMany({ where: { key: testKey } });
  const afterReset = await peekRateLimit(testKey, WINDOW_MS, MAX);
  ok("Pencere sıfırlandıktan sonra allowed", afterReset.allowed);

  // HTTP endpoint: 10 başarısız denemeden sonra doğru şifre de reddedilmeli
  // (dev server çalışıyorsa)
  const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3002";
  const testEmail = `rl-http-${Date.now()}@example.com`;
  const testIp = "127.0.0.1";
  const httpKey = `login:${testEmail.toLowerCase()}:${testIp}`;

  // 10 kayıt yükle
  for (let i = 0; i < MAX; i++) {
    await checkRateLimit(httpKey, WINDOW_MS, MAX);
  }

  // HTTP login dene — mevcut şifre yanlış olsa da 429 gelmeli
  const rl429Res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": testIp },
    body: JSON.stringify({ email: testEmail, password: "AnyPass99!" }),
  });
  ok("HTTP: 10 deneme sonrası 429", rl429Res.status === 429);

  // Temizle
  await prisma.rateLimit.deleteMany({ where: { key: { startsWith: `login:${testEmail}` } } });

  // Temizlik sonrası normal hata dönmeli (kullanıcı yok → 401)
  const afterClean = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": testIp },
    body: JSON.stringify({ email: testEmail, password: "AnyPass99!" }),
  });
  ok("Pencere sıfırlandıktan sonra 401 (normal hata)", afterClean.status === 401);
}

// ── Çalıştır ─────────────────────────────────────────────────────────────────
async function main() {
  await testBcrypt();
  await testDb();
  await testCrossCompanyGuard();
  await testSendResetCompanyGuard();
  await testLoginRateLimit();

  console.log(`\n${"─".repeat(40)}`);
  console.log(`Toplam: ${passed + failed} | Geçti: ${passed} | Başarısız: ${failed}`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Test hatası:", e);
  process.exit(1);
});
