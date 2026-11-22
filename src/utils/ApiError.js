// Throw this anywhere (controllers, middleware) - errorHandler turns it into a JSON response.
class ApiError extends Error {
  constructor(statusCode, message, errors) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors; // optional: field-level errors
  }
}

module.exports = ApiError;
