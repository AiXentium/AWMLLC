import nodemailer from "nodemailer";

const LEAD_EMAIL_TO = process.env.LEAD_NOTIFY_EMAIL ?? "info@awm.llc";
const LEAD_SMS_TO = process.env.LEAD_NOTIFY_SMS ?? "4074864555@tmomail.net";

export interface NewLeadInfo {
  id: string;
  name: string;
  company?: string | null;
  email: string;
  phone: string;
  projectName: string;
  projectAddress: string;
  city: string;
  projectType: string;
  budgetRange?: string | null;
  documentCount: number;
}

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.warn("[lead-notify] GMAIL_USER / GMAIL_APP_PASSWORD not set — skipping notifications");
    return null;
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

/**
 * Fires on every new website quote request. Sends:
 *  1. A detailed email to the AWM inbox.
 *  2. A short text via the carrier email-to-SMS gateway.
 * Both are free. Failures are logged, never thrown — the lead is already saved.
 */
export async function notifyNewLead(lead: NewLeadInfo): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  const from = process.env.GMAIL_USER!;
  const dashboardUrl = `${process.env.SITE_URL ?? "http://localhost:8081"}/app/quote-requests`;

  const emailHtml = `
    <h2>New quote request — ${lead.projectName}</h2>
    <table style="border-collapse:collapse">
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Contact</td><td>${lead.name}${lead.company ? ` (${lead.company})` : ""}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Email</td><td>${lead.email}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Phone</td><td>${lead.phone}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Project</td><td>${lead.projectName}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Address</td><td>${lead.projectAddress}, ${lead.city}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Type</td><td>${lead.projectType}</td></tr>
      ${lead.budgetRange ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold">Budget</td><td>${lead.budgetRange}</td></tr>` : ""}
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Plans attached</td><td>${lead.documentCount}</td></tr>
    </table>
    <p><a href="${dashboardUrl}">Open in lead dashboard</a></p>
  `;

  const smsText =
    `AWM new lead: ${lead.name} — ${lead.projectName} (${lead.city}). ` +
    `${lead.phone}. ${lead.documentCount} plan(s). See dashboard.`;

  try {
    await transporter.sendMail({
      from: `AWM Website <${from}>`,
      to: LEAD_EMAIL_TO,
      subject: `New lead: ${lead.projectName} — ${lead.name}`,
      html: emailHtml,
    });
    console.log("[lead-notify] email sent to", LEAD_EMAIL_TO);
  } catch (err) {
    console.error("[lead-notify] email failed:", err);
  }

  try {
    await transporter.sendMail({
      from,
      to: LEAD_SMS_TO,
      subject: "",
      text: smsText.slice(0, 160),
    });
    console.log("[lead-notify] sms sent to", LEAD_SMS_TO);
  } catch (err) {
    console.error("[lead-notify] sms failed:", err);
  }
}
