const ApiError = require("../utils/ApiError");
const User = require("../models/User");
const { verifyAccessToken } = require("../utils/tokens");

// protect: requires a valid access token ->  Authorization: Bearer <accessToken>
const protect = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new ApiError(401, "Please log in");

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    // the frontend uses this message to know it should call /api/auth/refresh
    const message = err.name === "TokenExpiredError" ? "Access token expired" : "Invalid token";
    throw new ApiError(401, message);
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, "User no longer exists");

  req.user = user;
  next();
};

// restrictTo("admin") -> use after protect
const restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) throw new ApiError(403, "You do not have permission");
    next();
  };

module.exports = { protect, restrictTo };
