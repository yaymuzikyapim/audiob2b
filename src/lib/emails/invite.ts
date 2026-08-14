export function inviteEmailHtml({
  companyName,
  inviteUrl,
  role,
  expiresInDays,
}: {
  companyName: string;
  inviteUrl: string;
  role: string;
  expiresInDays: number;
}) {
  const roleLabel = role === "COMPANY_ADMIN" ? "Şirket Yöneticisi" : "Çalışan";

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AudioB2B Davet</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111118;border-radius:16px;border:1px solid #1f1f2e;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#0d1117;padding:28px 36px;border-bottom:1px solid #1f1f2e;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">AudioB2B</span>
              <span style="display:inline-block;margin-left:10px;background:rgba(52,211,153,0.12);color:#34d399;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;">Davet</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px;">
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Davet aldınız</p>
              <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;">
                ${companyName} ekibine katılın
              </h1>

              <div style="background:#0d1117;border:1px solid #1f1f2e;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
                <span style="display:block;font-size:12px;color:#6b7280;margin-bottom:4px;">Rol</span>
                <span style="font-size:15px;font-weight:600;color:#a78bfa;">${roleLabel}</span>
              </div>

              <p style="margin:0 0 28px;font-size:15px;color:#9ca3af;line-height:1.6;">
                <strong style="color:#e5e7eb;">${companyName}</strong> sizi AudioB2B kurumsal sesli kitap platformuna davet etti.
                Aşağıdaki butona tıklayarak hesabınızı oluşturun ve sesli kitap kütüphanenize erişin.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${inviteUrl}"
                      style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.2px;">
                      Hesabımı Oluştur →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:13px;color:#4b5563;text-align:center;">
                Bu link <strong style="color:#6b7280;">${expiresInDays} gün</strong> içinde geçersiz olacak.
              </p>
            </td>
          </tr>

          <!-- URL fallback -->
          <tr>
            <td style="padding:0 36px 20px;">
              <p style="margin:0;font-size:12px;color:#374151;">Buton çalışmıyorsa bu linki kopyalayın:</p>
              <p style="margin:6px 0 0;font-size:12px;color:#6b7280;word-break:break-all;">${inviteUrl}</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;border-top:1px solid #1f1f2e;">
              <p style="margin:0;font-size:12px;color:#374151;text-align:center;">
                Bu e-postayı beklemiyorsanız dikkate almayabilirsiniz. ·
                <span style="color:#4b5563;">AudioB2B by SesleKitap</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
