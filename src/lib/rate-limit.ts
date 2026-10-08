import { prisma } from "./prisma";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Mevcut penceredeki sayıyı okur — artırmaz.
 * Login gibi yalnızca başarısız denemeler sayılacaksa önce bu çağrılır.
 */
export async function peekRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const record = await prisma.rateLimit.findUnique({
    where: { key_windowStart: { key, windowStart } },
  });
  const count = record?.count ?? 0;
  return { allowed: count < maxRequests, remaining: Math.max(0, maxRequests - count) };
}

/**
 * DB-tabanlı kayan pencere hız sınırlayıcı — her çağrıda sayacı artırır.
 * key: "email:<email>", "ip:<ip>", "login:<email>:<ip>" gibi benzersiz bir değer.
 * windowMs: pencere uzunluğu ms cinsinden.
 * maxRequests: pencerede izin verilen maksimum istek sayısı.
 */
export async function checkRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);

  const record = await prisma.rateLimit.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });

  const allowed = record.count <= maxRequests;
  return { allowed, remaining: Math.max(0, maxRequests - record.count) };
}

// Hazır konfigürasyonlar
export const RATE_LIMIT = {
  /** Şifre sıfırlama e-postası: 5/saat per e-posta */
  resetEmail: (email: string) =>
    checkRateLimit(`reset-email:${email.toLowerCase()}`, 60 * 60 * 1000, 5),
  /** Şifre sıfırlama e-postası: 10/saat per IP */
  resetIp: (ip: string) =>
    checkRateLimit(`reset-ip:${ip}`, 60 * 60 * 1000, 10),
  /** Başarısız giriş sayacını artırır — sadece doğrulama başarısız olunca çağrılır. */
  recordLoginFailure: (email: string, ip: string) =>
    checkRateLimit(`login:${email.toLowerCase()}:${ip}`, 15 * 60 * 1000, 10),
  /** Penceredeki mevcut sayıyı kontrol eder — artırmaz. Her istekte kontrol için. */
  peekLoginFailures: (email: string, ip: string) =>
    peekRateLimit(`login:${email.toLowerCase()}:${ip}`, 15 * 60 * 1000, 10),
  /** Demo talebi: IP başına saatte 5 */
  demoIp: (ip: string) =>
    checkRateLimit(`demo-ip:${ip}`, 60 * 60 * 1000, 5),
} as const;

/** windowStart'tan daha eski kayıtları sil. cleanup/cron route'undan çağrılır. */
export async function cleanupRateLimits(olderThanMs = 2 * 60 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await prisma.rateLimit.deleteMany({
    where: { windowStart: { lt: cutoff } },
  });
  return result.count;
}
