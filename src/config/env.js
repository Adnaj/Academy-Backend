require("dotenv").config();

const required = ["MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "EMAIL_USER", "EMAIL_PASS"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const isProd = process.env.NODE_ENV === "production";

module.exports = {
  isProd,
  port: process.env.PORT || 5000,
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  mongoUri: process.env.MONGODB_URI,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpires: process.env.JWT_ACCESS_EXPIRES || "15m",
    refreshDays: Number(process.env.REFRESH_EXPIRES_DAYS) || 7,
  },
  cookie: {
    name: process.env.COOKIE_NAME || "refreshToken",
    sameSite: process.env.COOKIE_SAMESITE || "lax",
  },
    email: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
    careers: {
    // who gets the job-application emails: CAREERS_NOTIFY_EMAIL=hr@x.com,b@x.com (defaults to the lead recipients)
    notifyTo: (process.env.CAREERS_NOTIFY_EMAIL || process.env.LEADS_NOTIFY_EMAIL || process.env.EMAIL_USER)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },
    leads: {
    // who gets the "new lead" emails: LEADS_NOTIFY_EMAIL=a@x.com,b@x.com (defaults to EMAIL_USER)
    notifyTo: (process.env.LEADS_NOTIFY_EMAIL || process.env.EMAIL_USER)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },
};