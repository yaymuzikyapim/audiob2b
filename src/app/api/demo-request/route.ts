import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/mailer";

const SALES_EMAIL = process.env.SALES_EMAIL || "satis@audiob2b.com.tr";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).optional().default(""),
  employeeCount: z.string().trim().max(30).optional().default(""),
  message: z.string().trim().max(1000).optional().default(""),
  website: z.string().optional().default(""), // Honeypot
  formLoadedAt: z.coerce.number().optional(), // Bot / süre kontrolü
  kvkkAccepted: z.literal(true, "Lütfen Aydınlatma Metni'ni onaylayın."),
});

function sanitizeHeader(str: string) {
  // E-posta başlığında header injection (CRLF) engelleme
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

export async function POST(req: NextRequest) {
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

  // Honeypot kontrolü: bot doldurduysa hata vermeden dön
  if (d.website) {
    return NextResponse.json({ ok: true });
  }

  // Zaman kontrolü: form açılışından itibaren 1.5 saniyeden kısa sürede yollandıysa bot say
  if (d.formLoadedAt && Date.now() - d.formLoadedAt < 1500) {
    return NextResponse.json({ ok: true });
  }

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

  try {
    await sendEmail({
      to: SALES_EMAIL,
      subject,
      html,
    });
  } catch (err: unknown) {
    // KVKK gereği kişisel veriyi loga basmıyoruz, sadece teknik hata mesajını logluyoruz
    const errorMessage = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("[DemoRequest API Error]: E-posta iletimi başarısız oldu:", errorMessage);
    return NextResponse.json(
      { error: "E-posta iletimi sırasında bir hata oluştu." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
