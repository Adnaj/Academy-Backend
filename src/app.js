const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const env = require("./config/env.js");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

if (env.isProd) app.set("trust proxy", 1); // needed behind Nginx / Render / Railway etc.

// Middleware
app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true })); // credentials: true = allow the refresh cookie
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

// Test route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Backend API is working!",
  });
});

// API routes
app.use("/api", routes);

// 404 + error handling (must be last)
app.use(notFound);
app.use(errorHandler);

module.exports = app;