const { z } = require("zod");
const STATUSES = require("../utils/leadStatuses");

const optionalText = (max) => z.string().trim().max(max).nullish();

// multipart text fields arrive as plain strings in req.body (the CV is in req.file)
const careerSchema = z.object({
  fullName: z.string("Enter your full name").trim().min(2, "Enter your full name").max(80, "Name is too long"),
  email: z.string("Enter a valid email address").trim().email("Enter a valid email address").max(120),
  phone: z
    .string("Enter a valid phone number")
    .trim()
    .refine((v) => {
      const digits = v.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15;
    }, "Enter a valid phone number"),
  position: z.string("Please select your interested role").trim().min(1, "Please select your interested role").max(120),
  location: optionalText(80),
  experience: optionalText(40),
  message: optionalText(2000),
});

const careerUpdateSchema = z.object({
  status: z.enum(STATUSES).optional(),
  adminNote: z.string().trim().max(1000).optional(),
});

module.exports = { careerSchema, careerUpdateSchema };