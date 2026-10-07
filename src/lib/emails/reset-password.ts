import { sendEmail } from "@/lib/mailer";

export async function sendPasswordResetEmail(opts: {
  to: string;
  name: string | null;
  resetUrl: string;
}) {
  const display = opts.name ?? opts.to;
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
              Şifre Sıfırlama İsteği
            </h1>
            <p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.6">
              Merhaba ${display},
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.6">
              Hesabınız için şifre sıfırlama isteği aldık. Aşağıdaki bağlantıya tıklayarak
              yeni şifrenizi belirleyebilirsiniz.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:24px">
              <tr>
                <td style="background:#2563eb;border-radius:10px;padding:14px 28px">
                  <a href="${opts.resetUrl}"
                     style="color:#fff;font-size:15px;font-weight:600;text-decoration:none;display:block">
                    Şifremi Sıfırla
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.5">
              Bu bağlantı <strong style="color:#94a3b8">1 saat</strong> geçerlidir.
              Eğer bu isteği siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.
            </p>
            <p style="margin:24px 0 0;font-size:12px;color:#475569;word-break:break-all">
              Bağlantı çalışmıyorsa kopyalayın: ${opts.resetUrl}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #334155">
            <p style="margin:0;font-size:12px;color:#475569">
              © ${new Date().getFullYear()} AudioB2B — Bu e-postayı almak istemiyorsanız hesabınızın şifresi değiştirilmemiştir.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return sendEmail({
    to: opts.to,
    subject: "AudioB2B – Şifre Sıfırlama",
    html,
  });
}
