const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const env = require("../config/env");

// short-lived token, sent by the client in the Authorization header
const signAccessToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpires,
  });

// long-lived token, kept in an httpOnly cookie. `jti` = unique id of this token (stored in the DB)
const signRefreshToken = (user, jti) =>
  jwt.sign({ sub: user.id, jti }, env.jwt.refreshSecret, {
    expiresIn: `${env.jwt.refreshDays}d`,
  });

const verifyAccessToken = (token) => jwt.verify(token, env.jwt.accessSecret);
const verifyRefreshToken = (token) => jwt.verify(token, env.jwt.refreshSecret);

// only the hash of a refresh token is stored in the database
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const newJti = () => crypto.randomUUID();

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  newJti,
};
