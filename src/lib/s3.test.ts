/**
 * Birim testleri: S3_DELETE_DISABLED=true npx tsx src/lib/s3.test.ts
 *
 * Uygulama tarafındaki silme kapısını (src/lib/s3.ts) doğrular. AWS'ye hiçbir
 * istek gitmez: yalnızca silmenin ATLANDIĞI yol çağrılır, silmenin açık olduğu
 * yol için sadece karar fonksiyonu kontrol edilir.
 */

import { s3SilmeKapali, deleteFile } from "./s3";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, got?: unknown) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${got !== undefined ? ` (got: ${JSON.stringify(got)})` : ""}`);
    failed++;
  }
}

async function main() {
  console.log("\ns3SilmeKapali — karar fonksiyonu");
  process.env.S3_DELETE_DISABLED = "true";
  assert('"true" → kapalı', s3SilmeKapali() === true);
  process.env.S3_DELETE_DISABLED = "false";
  assert('"false" → açık', s3SilmeKapali() === false);
  process.env.S3_DELETE_DISABLED = "1";
  assert('"1" → açık (yalnızca "true" kapatır)', s3SilmeKapali() === false);
  delete process.env.S3_DELETE_DISABLED;
  assert("değişken yok → açık (bugünkü davranış)", s3SilmeKapali() === false);

  console.log("\ndeleteFile — S3_DELETE_DISABLED=true");
  process.env.S3_DELETE_DISABLED = "true";
  const r = await deleteFile("books/TEST/olmayan-dosya.mp3");
  assert("skipped = true (AWS'ye istek gitmedi)", r.skipped === true, r);

  console.log(`\n${failed === 0 ? "✅" : "❌"} s3 (uygulama kapısı): ${passed} geçti, ${failed} başarısız`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
