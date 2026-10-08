import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

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
  const { data, error } = await resend.emails.send({
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
