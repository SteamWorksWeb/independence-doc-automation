/**
 * src/lib/email.ts
 *
 * Resend-powered transactional email module.
 *
 * All functions in this file are SERVER-SIDE ONLY.
 * RESEND_API_KEY is never exposed to the browser.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { sendVerificationEmail } from "@/lib/email";
 *
 *   await sendVerificationEmail({
 *     to: "client@example.com",
 *     name: "Jane Smith",
 *     verificationUrl: "https://portal.theindependencelaw.com/verify?token=...",
 *   });
 *
 * ── From address ─────────────────────────────────────────────────────────────
 *
 * The "From" field uses the firm's domain via Resend's verified sending domain.
 * Set EMAIL_FROM in your environment to override the default:
 *
 *   EMAIL_FROM=portal@theindependencelaw.com
 *
 * ── Email clients ─────────────────────────────────────────────────────────────
 *
 * The HTML template uses table-based layout with inline CSS — the only safe
 * approach for Outlook, Gmail, Apple Mail, and Yahoo Mail compatibility.
 * A <style> block with media queries handles mobile responsiveness for clients
 * that support it (Apple Mail, Gmail App, most modern clients).
 */

import { Resend } from "resend";

// ── Environment validation ────────────────────────────────────────────────────

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error(
      "[email] RESEND_API_KEY is not set. " +
        "Add it to your .env.local file. See .env.example for instructions."
    );
  }

  return new Resend(apiKey);
}

function getFromAddress(): string {
  return process.env.EMAIL_FROM ?? "portal@theindependencelaw.com";
}

function getReplyToAddress(): string {
  return process.env.EMAIL_REPLY_TO ?? "support@theindependencelaw.com";
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SendVerificationEmailOptions {
  /** Recipient email address */
  to: string;
  /** Client's display name (used in greeting) */
  name: string;
  /** Full verification URL including token */
  verificationUrl: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ── Primary function ──────────────────────────────────────────────────────────

/**
 * Send the "Client Account Verification" email via Resend.
 *
 * Returns a structured result rather than throwing, so the caller
 * can decide whether to surface the error to the user or log silently.
 */
export async function sendVerificationEmail(
  opts: SendVerificationEmailOptions
): Promise<EmailResult> {
  const { to, name, verificationUrl } = opts;

  try {
    const resend = getResendClient();

    const { data, error } = await resend.emails.send({
      from: `The Independence Law Firm <${getFromAddress()}>`,
      to: [to],
      replyTo: getReplyToAddress(),
      subject: "Verify your client portal account",
      html: buildVerificationEmailHtml({ name, verificationUrl }),
      text: buildVerificationEmailText({ name, verificationUrl }),
    });

    if (error) {
      console.error("[email] Resend API error:", error);
      return { success: false, error: error.message };
    }

    console.log(`[email] Verification email sent to ${to}. Message ID: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[email] sendVerificationEmail failed:", message);
    return { success: false, error: message };
  }
}

// ── HTML template ─────────────────────────────────────────────────────────────

interface TemplateVars {
  name: string;
  verificationUrl: string;
}

function buildVerificationEmailHtml({ name, verificationUrl }: TemplateVars): string {
  const firstName = name.trim().split(" ")[0];
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Verify your account — The Independence Law Firm</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }

    /* Mobile */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .fluid { max-width: 100% !important; height: auto !important; }
      .stack-column, .stack-column-center { display: block !important; width: 100% !important; max-width: 100% !important; }
      .btn-cta { width: 100% !important; }
      .pd-sm { padding: 24px 20px !important; }
      .pd-header { padding: 24px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#eef0f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none;font-size:1px;color:#eef0f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Verify your email to activate your secure client portal account.
  </div>

  <!-- Email wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"
         width="100%" style="background-color:#eef0f5;padding:40px 0;">
    <tr>
      <td align="center" valign="top">

        <!-- Email container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0"
               class="email-container" style="width:600px;max-width:600px;">

          <!-- ── HEADER ────────────────────────────────────────── -->
          <tr>
            <td class="pd-header"
                style="background-color:#1a2744;padding:32px 40px;border-radius:8px 8px 0 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    <!-- Scales SVG logo inline -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding-right:12px;vertical-align:middle;">
                          <div style="width:36px;height:36px;background-color:rgba(179,30,60,0.15);border-radius:50%;display:inline-block;text-align:center;line-height:36px;">
                            ⚖
                          </div>
                        </td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:3px;
                                     text-transform:uppercase;color:#b31e3c;line-height:1;">THE</p>
                          <p style="margin:0;font-size:14px;font-weight:700;color:#ffffff;line-height:1.3;">
                            Independence Law Firm
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── CRIMSON ACCENT BAR ────────────────────────────── -->
          <tr>
            <td style="background-color:#b31e3c;height:3px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- ── BODY ──────────────────────────────────────────── -->
          <tr>
            <td class="pd-sm"
                style="background-color:#ffffff;padding:48px 40px 40px;">

              <!-- Greeting -->
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:2px;
                         text-transform:uppercase;color:#b31e3c;">
                Client Portal
              </p>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:800;font-style:italic;
                          color:#1a2744;line-height:1.2;letter-spacing:-0.5px;">
                Verify Your Account
              </h1>

              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
                Hello ${firstName},
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
                Thank you for creating an account with The Independence Law Firm's
                secure client portal. To activate your account and gain access to your
                case documents and legal team, please verify your email address below.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0"
                     style="margin:0 0 32px;">
                <tr>
                  <td class="btn-cta" style="border-radius:4px;background-color:#b31e3c;">
                    <a href="${verificationUrl}"
                       target="_blank"
                       style="display:inline-block;padding:15px 32px;font-size:14px;
                              font-weight:700;letter-spacing:1.5px;text-transform:uppercase;
                              color:#ffffff;text-decoration:none;border-radius:4px;
                              font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
                     style="margin:0 0 28px;">
                <tr>
                  <td style="border-top:1px solid #e5e7eb;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Expiry notice -->
              <p style="margin:0 0 16px;font-size:13px;color:#6b7280;line-height:1.6;">
                <strong style="color:#374151;">This link expires in 24 hours.</strong>
                If you did not create an account with The Independence Law Firm,
                you can safely ignore this email — no account will be activated.
              </p>

              <!-- Raw link fallback -->
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;line-height:1.5;">
                If the button above does not work, copy and paste this link into your browser:
              </p>
              <p style="margin:0;font-size:11px;color:#6b7280;word-break:break-all;line-height:1.5;">
                <a href="${verificationUrl}" style="color:#b31e3c;text-decoration:underline;">
                  ${verificationUrl}
                </a>
              </p>
            </td>
          </tr>

          <!-- ── SECURITY NOTICE ────────────────────────────────── -->
          <tr>
            <td style="background-color:#f9fafb;padding:20px 40px;border:1px solid #e5e7eb;
                        border-top:none;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding-right:12px;vertical-align:top;width:20px;">
                    <p style="margin:0;font-size:16px;">🔒</p>
                  </td>
                  <td>
                    <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">
                      <strong style="color:#374151;">Attorney-Client Privilege Protected.</strong>
                      All communications through this portal are protected by attorney-client
                      privilege. This email was sent to <strong>${"${to}"}</strong>.
                      Never share your login credentials with anyone.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── FOOTER ─────────────────────────────────────────── -->
          <tr>
            <td style="background-color:#1a2744;padding:24px 40px;border-radius:0 0 8px 8px;">
              <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.5);
                         text-align:center;line-height:1.6;">
                © ${year} The Independence Law Firm. All rights reserved.
              </p>
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);
                         text-align:center;line-height:1.6;">
                This is an automated message. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Email container -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ── Plain-text fallback ───────────────────────────────────────────────────────

function buildVerificationEmailText({ name, verificationUrl }: TemplateVars): string {
  const firstName = name.trim().split(" ")[0];
  const year = new Date().getFullYear();

  return `THE INDEPENDENCE LAW FIRM — Client Portal

Verify Your Account
───────────────────

Hello ${firstName},

Thank you for creating an account with The Independence Law Firm's secure client portal. To activate your account, please verify your email address by visiting the link below:

${verificationUrl}

This link expires in 24 hours.

If you did not create an account, you can safely ignore this email.

──────────────────────────────────────────────
Attorney-Client Privilege Protected.
All communications through this portal are protected by attorney-client privilege.

© ${year} The Independence Law Firm. All rights reserved.
This is an automated message. Please do not reply directly to this email.`;
}
