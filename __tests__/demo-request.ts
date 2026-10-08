/**
 * Demo talebi testleri.
 * Çalıştır: npx dotenvx run -- npx tsx __tests__/demo-request.ts
 *
 * Gerçek DB + HTTP (localhost:3002) kullanır. Test kayıtları sonunda temizlenir.
 */

import { config as loadEnvLocal } from "dotenv";
loadEnvLocal({ path: new URL("../.env.local", import.meta.url).pathname, override: true });

import assert from "assert";
import { prisma } from "../src/lib/prisma.js";
import { checkRateLimit } from "../src/lib/rate-limit.js";

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

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3002";
const TS = Date.now();

async function postDemo(payload: Record<string, unknown>, ip: string) {
  const res = await fetch(`${BASE_URL}/api/demo-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(payload),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const validPayload = {
  name: "Test Kullanıcı",
  company: "Test Şirketi",
  email: `demo-test-${TS}@example.com`,
  phone: "05551234567",
  employeeCount: "51-250",
  message: "Bu bir test talebidir.",
  website: "",
  formLoadedAt: Date.now() - 5000,
  kvkkAccepted: true,
};

async function testValid() {
  console.log("\nTest 1: Geçerli talep → DB kaydı + e-posta");
  const { status, json } = await postDemo(validPayload, `test-demo-${TS}-a`);
  ok("HTTP 200", status === 200);
  ok("ok:true döndü", json.ok === true);

  const record = await prisma.demoRequest.findFirst({
    where: { email: validPayload.email },
    orderBy: { createdAt: "desc" },
  });
  ok("DB kaydı oluştu", record !== null);
  ok("Şirket adı doğru", record?.company === validPayload.company);
  ok("KVKK onayı kaydedildi", record?.kvkkAccepted === true);
  ok("IP saklanmıyor", !Object.keys(record ?? {}).includes("ip"));
}

async function testHoneypot() {
  console.log("\nTest 2: Honeypot dolu → kayıt yok");
  const email = `demo-honeypot-${TS}@example.com`;
  const { status, json } = await postDemo(
    { ...validPayload, email, website: "http://spam.com" },
    `test-demo-${TS}-b`
  );
  ok("HTTP 200 (sahte başarı)", status === 200);
  ok("ok:true döndü", json.ok === true);

  const record = await prisma.demoRequest.findFirst({ where: { email } });
  ok("DB kaydı YOK", record === null);
}

async function testRateLimit() {
  console.log("\nTest 3: IP hız sınırı (saatte 5) → 429");
  const rlIp = `test-demo-${TS}-rl`;

  // Sayacı 5'e doldur (DB üzerinden direkt)
  for (let i = 0; i < 5; i++) {
    await checkRateLimit(`demo-ip:${rlIp}`, 60 * 60 * 1000, 5);
  }

  // 6. HTTP isteği → 429
  const email = `demo-rl-${TS}@example.com`;
  const { status, json } = await postDemo({ ...validPayload, email }, rlIp);
  ok("HTTP 429", status === 429);
  ok("Hata mesajı var", typeof json.error === "string");

  const count = await prisma.demoRequest.count({ where: { email } });
  ok("Rate limit sonrası DB kaydı yok", count === 0);
}

async function cleanup() {
  await prisma.demoRequest.deleteMany({
    where: { email: { in: [validPayload.email, `demo-honeypot-${TS}@example.com`] } },
  });
  await prisma.rateLimit.deleteMany({
    where: { key: { startsWith: `demo-ip:test-demo-${TS}` } },
  });
}

async function main() {
  await testValid();
  await testHoneypot();
  await testRateLimit();
  await cleanup();

  console.log(`\n${"─".repeat(40)}`);
  console.log(`Toplam: ${passed + failed} | Geçti: ${passed} | Başarısız: ${failed}`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Test hatası:", e);
  process.exit(1);
});
