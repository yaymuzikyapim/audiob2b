import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { RATE_LIMIT } from "@/lib/rate-limit";

const SALES_EMAIL = process.env.SALES_EMAIL || "satis@audiob2b.com.tr";

const schema = z.object({
  name: z.string().trim().min(2, "Lütfen adınızı girin.").max(100),
  company: z.string().trim().min(2, "Lütfen şirket adınızı girin.").max(150),
  email: z.string().trim().email("Geçerli bir iş e-postası girin.").max(200),
  phone: z.string().trim().max(30).optional().default(""),
  employeeCount: z.string().trim().max(30).optional().default(""),
  message: z.string().trim().max(1000).optional().default(""),
  website: z.string().optional().default(""), // Honeypot
  formLoadedAt: z.coerce.number().optional(), // Bot / süre kontrolü
  kvkkAccepted: z.boolean().refine((val) => val === true, {
    message: "Lütfen Aydınlatma Metni'ni onaylayın.",
  }),
});

function sanitizeHeader(str: string) {
  return str.replace(/[\r\n]+/g, " ").trim();
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // IP başına saatte 5 talep
  const rl = await RATE_LIMIT.demoIp(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla talep gönderildi. Lütfen bir saat sonra tekrar deneyin." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek formatı." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || "Lütfen zorunlu alanları eksiksiz doldurun.";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
  const d = parsed.data;

  // Honeypot: bot doldurduysa sahte başarı (rate limit sayacı artmış olsa da kayıt tutma)
  if (d.website) {
    return NextResponse.json({ ok: true });
  }

  // Süre: 1.5 saniyeden kısa → bot say
  if (d.formLoadedAt && Date.now() - d.formLoadedAt < 1500) {
    return NextResponse.json({ ok: true });
  }

  // DB'ye kaydet (e-posta başarısız olsa da kayıt kalır)
  let dbError: string | null = null;
  try {
    await prisma.demoRequest.create({
      data: {
        name: d.name,
        company: d.company,
        email: d.email,
        phone: d.phone || null,
        employeeCount: d.employeeCount || null,
        message: d.message || null,
        kvkkAccepted: d.kvkkAccepted,
      },
    });
  } catch (err: unknown) {
    dbError = err instanceof Error ? err.message : "Bilinmeyen DB hatası";
    console.error("[DemoRequest DB Error]:", dbError);
  }

  // E-posta gönder (kayıt başarısız olsa da denenir)
  const cleanCompany = sanitizeHeader(d.company);
  const subject = `AudioB2B Demo Talebi — ${cleanCompany}`;
  const html = `
    <h2>Yeni Kurumsal Demo Talebi</h2>
    <table cellpadding="6" style="font-family:sans-serif;font-size:14px;border-collapse:collapse;">
      <tr><td style="color:#666;"><b>Ad Soyad:</b></td><td>${esc(d.name)}</td></tr>
      <tr><td style="color:#666;"><b>Şirket:</b></td><td>${esc(d.company)}</td></tr>
      <tr><td style="color:#666;"><b>İş E-postası:</b></td><td>${esc(d.email)}</td></tr>
      <tr><td style="color:#666;"><b>Telefon:</b></td><td>${esc(d.phone) || "-"}</td></tr>
      <tr><td style="color:#666;"><b>Çalışan Sayısı:</b></td><td>${esc(d.employeeCount) || "-"}</td></tr>
      <tr><td style="color:#666;"><b>Mesaj:</b></td><td>${esc(d.message).replace(/\n/g, "<br>") || "-"}</td></tr>
      <tr><td style="color:#666;"><b>KVKK Onayı:</b></td><td>Alındı (Aydınlatma Metni okundu)</td></tr>
    </table>`;

  const text = `Yeni Kurumsal Demo Talebi

Ad Soyad: ${d.name}
Şirket: ${d.company}
İş E-postası: ${d.email}
Telefon: ${d.phone || "-"}
Çalışan Sayısı: ${d.employeeCount || "-"}
Mesaj: ${d.message || "-"}
KVKK Onayı: Alındı (Aydınlatma Metni okundu)`;

  let emailError: string | null = null;
  try {
    await sendEmail({ to: SALES_EMAIL, subject, html, text, replyTo: d.email });
  } catch (err: unknown) {
    emailError = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("[DemoRequest Email Error]:", emailError);
  }

  // Her ikisi de başarısız olduysa kullanıcıya hata dön
  if (dbError && emailError) {
    return NextResponse.json(
      { error: "Talebiniz iletilirken bir sorun oluştu." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
