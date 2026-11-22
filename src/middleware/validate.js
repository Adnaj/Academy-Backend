const ApiError = require("../utils/ApiError");

// validate(schema) -> checks req.body with a zod schema and replaces it with the cleaned data
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    return next(new ApiError(400, errors[0].message, errors));
  }
  req.body = result.data;
  next();
};

module.exports = validate;
