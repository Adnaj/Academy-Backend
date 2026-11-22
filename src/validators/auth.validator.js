const { z } = require("zod");

const email = z.string().trim().toLowerCase().email("Please enter a valid email");

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  email,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters") // bcrypt only uses the first 72 bytes
    .regex(/[A-Za-z]/, "Password must contain a letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(72),
});

const verifySignupSchema = z.object({
  email,
  otp: z.string().trim().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

module.exports = { signupSchema, loginSchema, verifySignupSchema };
