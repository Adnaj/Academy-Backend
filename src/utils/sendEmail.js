const nodemailer = require("nodemailer");
const env = require("../config/env");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: env.email.user, pass: env.email.pass },
});

const sendOtpEmail = (to, signupEmail, signupName, otp) =>
  transporter.sendMail({
    from: `"Catalyst SkillHub" <${env.email.user}>`,
    to,
    subject: `Signup OTP for ${signupEmail}`,
    text: `${signupName} (${signupEmail}) is signing up. OTP: ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:420px;margin:auto">
        <h2>New signup request</h2>
        <p><b>Name:</b> ${signupName}<br><b>Email:</b> ${signupEmail}</p>
        <p style="font-size:32px;letter-spacing:6px;font-weight:bold">${otp}</p>
        <p>This code expires in 10 minutes.</p>
      </div>`,
  });

  // ---- "new lead" notification ----
const esc = (v) =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const oneLine = (v) => String(v).replace(/[\r\n]+/g, " ").trim(); // never let user text break the email headers

// rows = [[label, value], ...]  (empty values are skipped)
const buildLeadEmail = ({ formLabel, name, phone, rows, submittedAt }) => {
  const filled = rows.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");
  const when = new Date(submittedAt || Date.now()).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true });

  const text = [`New lead: ${formLabel}`, "", ...filled.map(([l, v]) => `${l}: ${v}`), "", `Received: ${when} (IST)`].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
      <h2 style="margin:0 0 4px">New lead</h2>
      <p style="margin:0 0 16px;color:#666">${esc(formLabel)}</p>
      <table style="width:100%;border-collapse:collapse">
        ${filled
          .map(
            ([l, v]) => `<tr>
          <td style="padding:8px 10px;border:1px solid #e5e5e5;background:#f7f7f7;width:150px"><b>${esc(l)}</b></td>
          <td style="padding:8px 10px;border:1px solid #e5e5e5">${esc(v)}</td></tr>`
          )
          .join("")}
      </table>
      <p style="color:#888;font-size:12px;margin-top:14px">Received: ${esc(when)} (IST)</p>
    </div>`;

  return { subject: oneLine(`New lead - ${formLabel}: ${name} (${phone})`), text, html };
};

const sendLeadEmail = (lead) => {
  const { subject, text, html } = buildLeadEmail(lead);
  return transporter.sendMail({
    from: `"Catalyst SkillHub Leads" <${env.email.user}>`,
    to: env.leads.notifyTo,
    subject,
    text,
    html,
  });
};

// ---- "new job application" notification (CV attached) ----
// Goes to CAREERS_NOTIFY_EMAIL (falls back to the lead recipients).
const sendCareerEmail = ({ application: a, attachment }) => {
  const rows = [
    ["Name", a.fullName], ["Email", a.email], ["Phone", a.phone], ["Role", a.position],
    ["Current city", a.location], ["Experience", a.experience], ["Message", a.message],
  ];
  const { text, html } = buildLeadEmail({
    formLabel: "Careers - job application",
    name: a.fullName,
    phone: a.phone,
    rows,
    submittedAt: a.createdAt,
  });
  return transporter.sendMail({
    from: `"Catalyst SkillHub Careers" <${env.email.user}>`,
    to: env.careers.notifyTo,
    replyTo: oneLine(a.email), // hit Reply to answer the applicant directly
    subject: oneLine(`New application - ${a.position}: ${a.fullName} (${a.phone})`),
    text,
    html,
    attachments: [attachment],
  });
};

module.exports = { sendOtpEmail, sendLeadEmail, sendCareerEmail, buildLeadEmail };