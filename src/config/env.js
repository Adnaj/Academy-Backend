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
};