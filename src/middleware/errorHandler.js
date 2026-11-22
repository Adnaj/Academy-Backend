const env = require("../config/env");

const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message;

  if (err.code === 11000) {
    status = 409;
    message = "This email is already registered";
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Invalid JSON body";
  } else if (status === 500) {
    console.error(err);
    if (env.isProd) message = "Something went wrong";
  }

  res.status(status).json({ success: false, message, ...(err.errors && { errors: err.errors }) });
};

module.exports = { notFound, errorHandler };
