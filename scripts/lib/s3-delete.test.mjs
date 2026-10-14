/**
 * Birim testleri: node scripts/lib/s3-delete.test.mjs
 *
 * Gerçek S3'e hiçbir istek gitmez; S3Client yerine çağrıları kaydeden bir
 * sahte nesne kullanılır.
 */

import { deleteObject, deleteObjects, s3SilmeKapali } from "./s3-delete.mjs";

let passed = 0, failed = 0;

function assert(label, condition, got) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${got !== undefined ? ` (got: ${JSON.stringify(got)})` : ""}`); failed++; }
}

/** Gönderilen komutları kaydeden sahte S3 istemcisi. */
function sahteS3(cevap = {}) {
  const gonderilenler = [];
  return {
    gonderilenler,
    async send(cmd) {
      gonderilenler.push(cmd.constructor.name);
      return cevap;
    },
  };
}

const KAPALI = { S3_DELETE_DISABLED: "true" };
const ACIK = {};

// ── s3SilmeKapali ───────────────────────────────────────────────────────────
console.log("\ns3SilmeKapali");
assert('"true" → kapalı', s3SilmeKapali(KAPALI) === true);
assert("değişken yok → açık", s3SilmeKapali(ACIK) === false);
assert('"false" → açık', s3SilmeKapali({ S3_DELETE_DISABLED: "false" }) === false);
assert('"1" → açık (yalnızca "true" kapatır)', s3SilmeKapali({ S3_DELETE_DISABLED: "1" }) === false);
assert('"TRUE" → açık (büyük harf kapatmaz)', s3SilmeKapali({ S3_DELETE_DISABLED: "TRUE" }) === false);

// ── deleteObject ────────────────────────────────────────────────────────────
console.log("\ndeleteObject — S3_DELETE_DISABLED=true");
{
  const s3 = sahteS3();
  const loglar = [];
  const r = await deleteObject(s3, { bucket: "b", key: "books/x/1.mp3", env: KAPALI, log: (m) => loglar.push(m) });
  assert("S3'e hiç istek gitmedi", s3.gonderilenler.length === 0, s3.gonderilenler);
  assert("skipped = true", r.skipped === true, r);
  assert("deleted = 0", r.deleted === 0, r);
  assert('"atlandı" logu düştü', loglar.length === 1 && loglar[0].includes("atlandı"), loglar);
  assert("logda anahtar adı var", loglar[0].includes("books/x/1.mp3"));
}

console.log("\ndeleteObject — değişken yok (bugünkü davranış)");
{
  const s3 = sahteS3();
  const loglar = [];
  const r = await deleteObject(s3, { bucket: "b", key: "books/x/1.mp3", env: ACIK, log: (m) => loglar.push(m) });
  assert("DeleteObjectCommand gönderildi", s3.gonderilenler.length === 1 && s3.gonderilenler[0] === "DeleteObjectCommand", s3.gonderilenler);
  assert("skipped = false", r.skipped === false, r);
  assert("deleted = 1", r.deleted === 1, r);
  assert("log düşmedi", loglar.length === 0, loglar);
}

// ── deleteObjects ───────────────────────────────────────────────────────────
console.log("\ndeleteObjects — S3_DELETE_DISABLED=true");
{
  const s3 = sahteS3();
  const loglar = [];
  const r = await deleteObjects(s3, { bucket: "b", keys: ["a.mp3", "b.mp3", "c.mp3"], env: KAPALI, log: (m) => loglar.push(m) });
  assert("S3'e hiç istek gitmedi", s3.gonderilenler.length === 0, s3.gonderilenler);
  assert("skipped = true, deleted = 0", r.skipped === true && r.deleted === 0, r);
  assert("logda nesne sayısı var", loglar.length === 1 && loglar[0].includes("3 nesne"), loglar);
}

console.log("\ndeleteObjects — değişken yok");
{
  const s3 = sahteS3({ Errors: [] });
  const r = await deleteObjects(s3, { bucket: "b", keys: ["a.mp3", "b.mp3"], env: ACIK });
  assert("DeleteObjectsCommand gönderildi", s3.gonderilenler[0] === "DeleteObjectsCommand", s3.gonderilenler);
  assert("deleted = 2", r.skipped === false && r.deleted === 2, r);
}

console.log("\ndeleteObjects — hatalı anahtarlar sayımdan düşer");
{
  const s3 = sahteS3({ Errors: [{ Key: "b.mp3", Message: "AccessDenied" }] });
  const r = await deleteObjects(s3, { bucket: "b", keys: ["a.mp3", "b.mp3"], env: ACIK });
  assert("deleted = 1", r.deleted === 1, r);
  assert("errors listesi döner", r.errors.length === 1 && r.errors[0].Key === "b.mp3", r.errors);
}

console.log("\ndeleteObjects — boş liste");
{
  const s3 = sahteS3();
  const r = await deleteObjects(s3, { bucket: "b", keys: [], env: KAPALI });
  assert("istek yok, deleted = 0", s3.gonderilenler.length === 0 && r.deleted === 0, r);
}

console.log(`\n${failed === 0 ? "✅" : "❌"} s3-delete: ${passed} geçti, ${failed} başarısız`);
process.exit(failed === 0 ? 0 : 1);
