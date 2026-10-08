import { sendEmail } from "@/lib/mailer";
import { getBaseUrl } from "@/lib/base-url";

export async function sendPasswordChangedEmail(opts: {
  to: string;
  name: string | null;
  ipAddress?: string | null;
}) {
  const display = opts.name ?? opts.to;
  const ipLine = opts.ipAddress
    ? `<p style="margin:0 0 8px;font-size:13px;color:#64748b">İşlem IP adresi: <strong style="color:#94a3b8">${opts.ipAddress}</strong></p>`
    : "";
  const ipText = opts.ipAddress ? `İşlem IP adresi: ${opts.ipAddress}\n` : "";
  const forgotUrl = `${getBaseUrl()}/forgot-password`;

  const html = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;max-width:560px;width:100%">
        <tr>
          <td style="background:#2563eb;padding:28px 32px">
            <p style="margin:0;font-size:22px;font-weight:700;color:#fff">AudioB2B</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#f1f5f9">
              Şifreniz Değiştirildi
            </h1>
            <p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.6">
              Merhaba ${display},
            </p>
            <p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.6">
              AudioB2B hesabınızın şifresi başarıyla değiştirildi.
            </p>
            ${ipLine}
            <p style="margin:16px 0 0;font-size:13px;color:#64748b;line-height:1.5">
              Bu işlemi siz yapmadıysanız lütfen hemen
              <a href="${forgotUrl}"
                 style="color:#60a5fa">şifrenizi sıfırlayın</a> ve
              destek ekibimizle iletişime geçin.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #334155">
            <p style="margin:0 0 4px;font-size:12px;color:#475569">
              AudioB2B · YAY Prodüksiyon
            </p>
            <p style="margin:0;font-size:12px;color:#475569">
              Bu e-postayı AudioB2B hesabınız için gönderdik.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Merhaba ${display},

AudioB2B hesabınızın şifresi başarıyla değiştirildi.
${ipText}
Bu işlemi siz yapmadıysanız lütfen hemen şifrenizi sıfırlayın:
${forgotUrl}

AudioB2B · YAY Prodüksiyon
Bu e-postayı AudioB2B hesabınız için gönderdik.`;

  return sendEmail({
    to: opts.to,
    subject: "AudioB2B – Şifreniz Değiştirildi",
    html,
    text,
  });
}
