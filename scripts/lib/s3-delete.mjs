/**
 * S3 silme kapısı — tüm silme çağrıları buradan geçer.
 *
 * S3_DELETE_DISABLED=true ise hiçbir nesne silinmez; "atlandı" logu düşer ve
 * çağıran kod normal akışına devam eder. Değişken yoksa ya da "true" değilse
 * davranış bugünküyle aynıdır (canlı etkilenmez).
 *
 * Kullanım (.mjs scriptler, kendi env nesnesini okuyanlar):
 *
 *   import { deleteObject, deleteObjects } from "../scripts/lib/s3-delete.mjs";
 *   await deleteObject(s3, { bucket: env.AWS_S3_BUCKET, key, env });
 *
 * src/lib/s3.ts içindeki deleteFile() aynı kapıyı uygulamanın tarafında kurar.
 */

import { DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";

/** Silme kapalı mı? Yalnızca tam "true" değeri kapatır. */
export function s3SilmeKapali(env = process.env) {
  return String(env?.S3_DELETE_DISABLED ?? "") === "true";
}

/** Tek nesne siler. Kapalıysa { skipped: true } döner, S3'e istek gitmez. */
export async function deleteObject(s3, { bucket, key, env = process.env, log = console.warn } = {}) {
  if (s3SilmeKapali(env)) {
    log(`[s3] silme atlandı (S3_DELETE_DISABLED=true): ${key}`);
    return { skipped: true, deleted: 0 };
  }
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  return { skipped: false, deleted: 1 };
}

/**
 * Toplu siler (en çok 1000 anahtar). Kapalıysa S3'e istek gitmez.
 * `deleted` = gönderilen anahtar sayısı eksi hata sayısı; Quiet modunda da doğru.
 */
export async function deleteObjects(s3, { bucket, keys, env = process.env, log = console.warn, quiet = true } = {}) {
  const liste = (keys ?? []).filter(Boolean);
  if (liste.length === 0) return { skipped: false, deleted: 0, errors: [] };

  if (s3SilmeKapali(env)) {
    log(`[s3] toplu silme atlandı (S3_DELETE_DISABLED=true): ${liste.length} nesne`);
    return { skipped: true, deleted: 0, errors: [] };
  }

  const r = await s3.send(new DeleteObjectsCommand({
    Bucket: bucket,
    Delete: { Objects: liste.map((Key) => ({ Key })), Quiet: quiet },
  }));
  const errors = r.Errors ?? [];
  return { skipped: false, deleted: liste.length - errors.length, errors };
}
