import { Resend } from "resend";

// Resend istemcisi ilk gönderimde kurulur.
// Modül yüklenirken kurulursa RESEND_API_KEY boş olan ortamlarda (geliştirme,
// `next build`) constructor "Missing API key" ile patlar ve bu modülü import eden
// her route derleme/çalışma anında 500 verir. Hata artık yalnızca gerçekten
// e-posta gönderilmek istendiğinde ve anlaşılır bir mesajla çıkıyor.
let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY tanımlı değil — e-posta gönderilemez.");
    resendClient = new Resend(key);
  }
  return resendClient;
}

export const FROM_ADDRESS = process.env.EMAIL_FROM ?? "AudioB2B <bildirim@audiob2b.com.tr>";
const REPLY_TO_ADDRESS = process.env.EMAIL_REPLY_TO ?? "satis@audiob2b.com.tr";

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}) {
  const { data, error } = await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html,
    text,
    replyTo: replyTo ?? REPLY_TO_ADDRESS,
  });

  if (error) {
    console.error("[Resend] E-posta gönderilemedi:", error);
    throw new Error(error.message);
  }

  return data;
}
