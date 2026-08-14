import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export const FROM_ADDRESS = process.env.EMAIL_FROM || "AudioB2B <davet@audiob2b.com>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html,
  });

  if (error) {
    console.error("[Resend] E-posta gönderilemedi:", error);
    throw new Error(error.message);
  }

  return data;
}
