/**
 * QA şirketindeki bir kullanıcının şifresini güvenli biçimde ayarlar.
 * Kullanım: npx tsx scripts/set-qa-password.ts <email>
 *
 * - Yalnızca AudioB2B QA şirketi (id: cmbqr6l9nxbmjh8kztutjmmds) kullanıcıları için çalışır.
 * - Şifre terminale yansımaz; çıktıya, loga veya dosyaya yazılmaz.
 */

import { createInterface } from "readline";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { newPasswordSchema, hashPassword, isCommonPassword } from "../src/lib/password";

config({ path: ".env" });
config({ path: ".env.local", override: true });

const QA_COMPANY_ID = "cmbqr6l9nxbmjh8kztutjmmds";

// ── Gizli şifre okuma ────────────────────────────────────────────────────────

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("TTY gerekli: script interaktif bir terminalde çalıştırılmalı."));
      return;
    }
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    let value = "";

    const onData = (char: string) => {
      if (char === "\r" || char === "\n" || char === "\u0004") {
        process.stdout.write("\n");
        cleanup();
        resolve(value);
      } else if (char === "\u0003") {
        cleanup();
        process.stdout.write("\n");
        process.exit(1);
      } else if (char === "\u007f" || char === "\b") {
        if (value.length > 0) value = value.slice(0, -1);
      } else {
        value += char;
      }
    };

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
    };

    process.stdin.on("data", onData);
  });
}

// ── Ana akış ─────────────────────────────────────────────────────────────────

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Kullanım: npx tsx scripts/set-qa-password.ts <email>");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    // Kullanıcıyı bul ve şirket kontrolü yap
    const user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true, companyId: true, company: { select: { name: true } } },
    });

    if (!user) {
      console.error(`Kullanıcı bulunamadı: ${email}`);
      process.exit(1);
    }

    if (user.companyId !== QA_COMPANY_ID) {
      console.error(
        `Hata: ${email} AudioB2B QA şirketine ait değil. ` +
        `Bu script yalnızca QA şirketi kullanıcıları için çalışır.`
      );
      process.exit(1);
    }

    // Şifreyi gizli olarak iki kez al
    const pw1 = await readHidden("Yeni şifre: ");
    const pw2 = await readHidden("Yeni şifre (tekrar): ");

    if (pw1 !== pw2) {
      console.error("Hata: Şifreler eşleşmiyor.");
      process.exit(1);
    }

    // Doğrulama
    const parsed = newPasswordSchema.safeParse(pw1);
    if (!parsed.success) {
      console.error("Hata:", parsed.error.issues[0].message);
      process.exit(1);
    }

    if (isCommonPassword(pw1, user.company?.name ?? undefined)) {
      console.error("Hata: Bu şifre çok yaygın, daha güçlü bir şifre seçin.");
      process.exit(1);
    }

    // Hash ve kaydet
    const hash = await hashPassword(pw1);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hash, passwordChangedAt: new Date() },
      }),
      prisma.passwordAuditLog.create({
        data: {
          userId: user.id,
          actorId: null,
          event: "ADMIN_TRIGGER",
          ipAddress: "local-script",
          userAgent: "set-qa-password.ts",
        },
      }),
    ]);

    console.log(`Şifre güncellendi: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Beklenmeyen hata:", err.message ?? err);
  process.exit(1);
});
