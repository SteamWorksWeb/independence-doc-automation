/**
 * src/lib/mailer.ts
 *
 * Nodemailer transport — all SMTP credentials from environment variables.
 * Never hardcode credentials here.
 */

import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "[mailer] Missing SMTP configuration. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in your .env.local file."
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail(options: SendMailOptions): Promise<void> {
  const transport = createTransport();
  const fromName = process.env.EMAIL_FROM_NAME ?? "The Independence Law Firm";
  const fromAddress =
    process.env.EMAIL_FROM_ADDRESS ?? "noreply@theindependencelaw.com";

  await transport.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}
