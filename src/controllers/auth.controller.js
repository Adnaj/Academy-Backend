const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const PendingSignup = require("../models/PendingSignup");
const { sendOtpEmail } = require("../utils/sendEmail");

const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  newJti,
} = require("../utils/tokens");

const REFRESH_COOKIE_PATH = "/api/auth"; // the browser only sends the cookie to the auth routes

const cookieOptions = () => ({
  httpOnly: true, // JavaScript cannot read it (protects from XSS)
  secure: env.isProd || env.cookie.sameSite === "none",
  sameSite: env.cookie.sameSite,
  path: REFRESH_COOKIE_PATH,
});

const setRefreshCookie = (res, token) =>
  res.cookie(env.cookie.name, token, {
    ...cookieOptions(),
    maxAge: env.jwt.refreshDays * 24 * 60 * 60 * 1000,
  });

const clearRefreshCookie = (res) => res.clearCookie(env.cookie.name, cookieOptions());

// Creates a new login session: access token (JSON) + refresh token (httpOnly cookie, hash saved in DB)
const startSession = async (user, req, res, status = 200) => {
  const jti = newJti();
  const refreshToken = signRefreshToken(user, jti);
  const accessToken = signAccessToken(user);

  await RefreshToken.create({
    user: user._id,
    jti,
    tokenHash: hashToken(refreshToken),
    userAgent: req.get("user-agent"),
    ip: req.ip,
    expiresAt: new Date(Date.now() + env.jwt.refreshDays * 24 * 60 * 60 * 1000),
  });

  setRefreshCookie(res, refreshToken);
  res.status(status).json({ success: true, user, accessToken });
};

const OTP_MINUTES = 10;
const OTP_RESEND_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;

const generateOtp = () => String(crypto.randomInt(100000, 1000000));
const hashOtp = (email, otp) => hashToken(`${email}:${otp}`);

// POST /api/auth/signup
// POST /api/auth/signup  -> validates, sends OTP email (no account created yet)
// Calling it again for the same email resends a fresh OTP.
const signup = async (req, res) => {
  const { name, email, password } = req.body;

  if (await User.exists({ email })) throw new ApiError(409, "This email is already registered");

  const existing = await PendingSignup.findOne({ email });
  if (existing && Date.now() - existing.lastSentAt.getTime() < OTP_RESEND_SECONDS * 1000) {
    throw new ApiError(429, `Please wait ${OTP_RESEND_SECONDS} seconds before requesting another OTP`);
  }

  const otp = generateOtp();
  await PendingSignup.findOneAndUpdate(
    { email },
    {
      name,
      passwordHash: await bcrypt.hash(password, 12),
      otpHash: hashOtp(email, otp),
      attempts: 0,
      lastSentAt: new Date(),
      expiresAt: new Date(Date.now() + OTP_MINUTES * 60 * 1000),
    },
    { upsert: true }
  );

  try {
   await sendOtpEmail(env.email.user, email, name, otp);
  } catch (err) {
    console.error("OTP email failed:", err.message);
    await PendingSignup.deleteOne({ email });
    throw new ApiError(502, "Could not send OTP email. Please try again");
  }

  res.json({ success: true, message: `OTP sent to ${email}. It expires in ${OTP_MINUTES} minutes.` });
};

// POST /api/auth/signup/verify  -> checks OTP, creates the user, logs them in
const verifySignup = async (req, res) => {
  const { email, otp } = req.body;

  const pending = await PendingSignup.findOne({ email });
  if (!pending) throw new ApiError(400, "OTP expired or not requested. Please sign up again");

  if (pending.attempts >= MAX_OTP_ATTEMPTS) {
    await pending.deleteOne();
    throw new ApiError(429, "Too many wrong attempts. Please sign up again");
  }

  if (pending.otpHash !== hashOtp(email, otp)) {
    pending.attempts += 1;
    await pending.save();
    throw new ApiError(400, "Invalid OTP");
  }

  if (await User.exists({ email })) {
    await pending.deleteOne();
    throw new ApiError(409, "This email is already registered");
  }

  const user = new User({ name: pending.name, email, password: pending.passwordHash });
  user.$locals.skipHash = true; // password is already hashed
  await user.save();
  await pending.deleteOne();

  await startSession(user, req, res, 201);
};

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");
  // same message for unknown email and wrong password
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password");
  }

  await startSession(user, req, res);
};

// POST /api/auth/refresh  - uses the refresh cookie, returns a new access token (+ rotates the refresh token)
const refresh = async (req, res) => {
  const token = req.cookies[env.cookie.name];
  if (!token) throw new ApiError(401, "No refresh token");

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    clearRefreshCookie(res);
    throw new ApiError(401, "Session expired, please log in again");
  }

  const stored = await RefreshToken.findOne({ jti: payload.jti });

  // Token is valid but not in the DB (or does not match) = it was already used -> possible theft.
  // Log the user out of every device.
  if (!stored || stored.tokenHash !== hashToken(token)) {
    await RefreshToken.deleteMany({ user: payload.sub });
    clearRefreshCookie(res);
    throw new ApiError(401, "Session expired, please log in again");
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    await stored.deleteOne();
    clearRefreshCookie(res);
    throw new ApiError(401, "User no longer exists");
  }

  await stored.deleteOne(); // rotation: every refresh token can be used only once
  await startSession(user, req, res);
};

// POST /api/auth/logout  - ends this device's session
const logout = async (req, res) => {
  const token = req.cookies[env.cookie.name];
  if (token) {
    try {
      const { jti } = verifyRefreshToken(token);
      await RefreshToken.deleteOne({ jti });
    } catch {
      /* expired / invalid token - nothing to remove */
    }
  }
  clearRefreshCookie(res);
  res.json({ success: true, message: "Logged out" });
};

// POST /api/auth/logout-all  (protected) - ends every session of this user
const logoutAll = async (req, res) => {
  await RefreshToken.deleteMany({ user: req.user._id });
  clearRefreshCookie(res);
  res.json({ success: true, message: "Logged out from all devices" });
};

// GET /api/auth/me  (protected)
const me = (req, res) => {
  res.json({ success: true, user: req.user });
};

module.exports = { signup, verifySignup, login, refresh, logout, logoutAll, me };
