import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";

// ── Ortak şifreler ───────────────────────────────────────────────────────────
// Top-100 genel + Türkçe yaygın; şirket adı ve "audiob2b" runtime'da kontrol edilir.
const COMMON_PASSWORDS = new Set([
  "123456","12345678","password","qwerty","123456789","12345","1234567",
  "1234567890","123123","abc123","111111","987654321","iloveyou","master",
  "welcome","login","admin","letmein","monkey","1234","sunshine","princess",
  "password1","shadow","superman","dragon","passw0rd","trustno1","hello",
  "freedom","whatever","qazwsx","password123","654321","azerty","iloveyou1",
  "111222333","123321","batman","samsung","michael","football","starwars",
  "mustafa","elif","mehmet","ayse","ankara","istanbul","turkiye","sifre",
  "123456a","test1234","pasword","şifre","qwerty123","qwerty1","pass1234",
  "audiob2b","seslikitap","sesle",
]);

export function isCommonPassword(password: string, companyName?: string): boolean {
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return true;
  if (companyName) {
    // Her kelimeyi ayrı ayrı kontrol et (örn. "Acme Corp" → ["acme", "corp"])
    const words = companyName.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
    if (words.some((w) => lower.includes(w))) return true;
  }
  return false;
}

// ── Zod şemaları ─────────────────────────────────────────────────────────────

export const newPasswordSchema = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalı.")
  .max(72, "Şifre en fazla 72 karakter olabilir.")
  .refine((v) => /[A-Z]/.test(v), "En az bir büyük harf içermeli.")
  .refine((v) => /[0-9]/.test(v), "En az bir rakam içermeli.");

export const forgotPasswordSchema = z.object({
  email: z.string().email("Geçerli bir e-posta girin."),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: newPasswordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mevcut şifreyi girin."),
  newPassword: newPasswordSchema,
});

// ── Token yardımcıları ───────────────────────────────────────────────────────

/** Kriptografik olarak güvenli 32 byte token üretir, ham ve hash halini döner. */
export function generateResetToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ── Bcrypt yardımcıları ──────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
