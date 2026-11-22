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

module.exports = { sendOtpEmail };