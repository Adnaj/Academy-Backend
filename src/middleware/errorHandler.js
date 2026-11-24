const env = require("../config/env");

const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message;
  let errors = err.errors;

  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || {})[0];
    message = field === "email" ? "This email is already registered" : `${field || "Value"} already exists`;
  } else if (err.name === "ValidationError") {
    status = 400;
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = errors[0]?.message || "Validation failed";
  } else if (err.name === "CastError") {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Invalid JSON body";
  } else if (status === 500) {
    console.error(err);
    if (env.isProd) message = "Something went wrong";
  }

  res.status(status).json({ success: false, message, ...(errors && { errors }) });
};

module.exports = { notFound, errorHandler };