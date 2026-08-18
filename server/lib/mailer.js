/**
 * Automated Email Dispatcher for Afterchat Intelligence Reports
 * Uses Nodemailer with Gmail SMTP.
 */

import nodemailer from 'nodemailer';
import { generateUnlockToken } from './razorpay.js';

/**
 * Creates and configures the Nodemailer SMTP transporter.
 */
function createTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass || user.includes('your_email')) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user.trim(),
      pass: pass.trim(),
    },
  });
}

/**
 * Generates an editorial, classified agency-style HTML email.
 */
function generateEmailHtml({
  email,
  participants = 'Participants',
  totalMessages = 0,
  storyTitle = 'The Complete WhatsApp Dossier',
  overallTone = 'Chaotic Comfort',
  verdict = 'A legendary conversation archive documented forever.',
  paymentId = 'N/A',
  reportUrl,
}) {
  const baseUrl = process.env.APP_URL || 'http://localhost:5173';
  const token = generateUnlockToken(paymentId || 'verified');
  const finalReportUrl =
    reportUrl ||
    `${baseUrl.replace(/\/$/, '')}/report?payment_id=${encodeURIComponent(paymentId || 'verified')}&token=${encodeURIComponent(token)}&download=true`;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; padding: 0; background-color: #0c0d10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e8e0d2; }
    .container { max-width: 600px; margin: 0 auto; background: #14161d; border: 1px solid rgba(204, 81, 61, 0.3); border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #1f1212 0%, #0c0d10 100%); padding: 32px 24px; text-align: center; border-bottom: 2px solid #cc513d; }
    .badge { display: inline-block; background: rgba(204, 81, 61, 0.2); border: 1px solid #cc513d; color: #ff8a75; font-family: monospace; font-size: 11px; font-weight: bold; padding: 4px 12px; border-radius: 999px; letter-spacing: 1px; margin-bottom: 12px; }
    .title { color: #ffffff; font-size: 24px; font-weight: 800; margin: 0 0 8px 0; }
    .subtitle { color: #a8a090; font-size: 14px; margin: 0; }
    .content { padding: 28px 24px; }
    .card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 18px; margin-bottom: 20px; }
    .card-title { color: #f59e0b; font-family: monospace; font-size: 12px; font-weight: bold; margin: 0 0 8px 0; letter-spacing: 0.5px; }
    .stat-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
    .stat-label { color: #8c8270; }
    .stat-value { color: #ffffff; font-weight: 600; }
    .verdict-box { background: rgba(204, 81, 61, 0.1); border-left: 3px solid #cc513d; padding: 14px; border-radius: 0 6px 6px 0; margin-bottom: 24px; }
    .verdict-title { color: #ff8a75; font-size: 12px; font-weight: bold; font-family: monospace; margin: 0 0 4px 0; }
    .verdict-text { color: #e8e0d2; font-size: 14px; line-height: 1.5; margin: 0; font-style: italic; }
    .button-wrap { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: #cc513d; color: #ffffff !important; text-decoration: none; font-weight: bold; font-size: 15px; padding: 14px 28px; border-radius: 8px; box-shadow: 0 4px 14px rgba(204, 81, 61, 0.4); }
    .footer { background: #0c0d10; padding: 20px 24px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06); font-size: 11px; color: #736d62; }
    .footer a { color: #cc513d; text-decoration: none; }
  </style>
</head>
<body>
  <div style="padding: 20px 10px;">
    <div class="container">
      <div class="header">
        <span class="badge">🔒 CLASSIFIED CASE FILE DELIVERED</span>
        <h1 class="title">Your Complete 6-Page Dossier is Ready</h1>
        <p class="subtitle">Archive investigation for <strong>${participants}</strong></p>
      </div>

      <div class="content">
        <p style="font-size: 14px; line-height: 1.6; color: #d4cbb8;">
          Thank you for unlocking your Afterchat AI investigation. Your full unedited case file, complete with all 10 chapters, era timelines, behavioral profiles, inside joke lore, and satirical awards ceremony is now permanently unlocked.
        </p>

        <div class="card">
          <div class="card-title">CASE FILE METRICS</div>
          <div style="font-size: 13px; line-height: 1.8;">
            <div style="color: #8c8270;">Subjects: <strong style="color: #fff;">${participants}</strong></div>
            <div style="color: #8c8270;">Messages Analyzed: <strong style="color: #fff;">${totalMessages.toLocaleString()}</strong></div>
            <div style="color: #8c8270;">Overall Tone: <strong style="color: #f59e0b;">${overallTone}</strong></div>
            <div style="color: #8c8270;">Payment Ref ID: <strong style="color: #10b981; font-family: monospace;">${paymentId}</strong></div>
          </div>
        </div>

        <div class="verdict-box">
          <div class="verdict-title">OFFICIAL RELATIONSHIP VERDICT</div>
          <p class="verdict-text">"${verdict}"</p>
        </div>

        <div class="button-wrap">
          <a href="${finalReportUrl}" class="btn">View Unlocked Dossier & Download PDF →</a>
        </div>

        <p style="font-size: 12px; color: #8c8270; text-align: center; margin: 0;">
          Tip: You can download the high-res 6-page printable PDF directly inside your report view anytime.
        </p>
      </div>

      <div class="footer">
        <p style="margin: 0 0 6px 0;">Afterchat AI • 100% Private Conversation Intelligence</p>
        <p style="margin: 0;">Need assistance? Contact us at <a href="mailto:iamafterchat@gmail.com">iamafterchat@gmail.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Sends the unlocked intelligence report to the user's email address.
 */
export async function sendReportEmail({
  to,
  participants,
  totalMessages,
  storyTitle,
  overallTone,
  verdict,
  paymentId,
  attachments = [],
}) {
  if (!to || !to.includes('@')) {
    console.warn('[Mailer] Skipping email dispatch: Invalid recipient email:', to);
    return { success: false, error: 'Invalid recipient email' };
  }

  const transporter = createTransporter();
  if (!transporter) {
    console.warn(
      `[Mailer] SMTP credentials not configured in server/.env (SMTP_USER / SMTP_PASS). Skipped dispatch to ${to}.`
    );
    return {
      success: false,
      error: 'SMTP credentials not configured in server/.env',
    };
  }

  const fromAddress = process.env.SMTP_FROM || `Afterchat Intelligence <${process.env.SMTP_USER}>`;

  const html = generateEmailHtml({
    email: to,
    participants,
    totalMessages,
    storyTitle,
    overallTone,
    verdict,
    paymentId,
  });

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject: `📜 Your Classified Dossier is Ready: ${participants || 'WhatsApp Case File'}`,
      html,
      attachments,
    });

    console.log(`[Mailer] ✅ Report email successfully sent to ${to} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Mailer] ❌ Error sending email to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}
