const mongoose = require("mongoose");
const Testimonial = require("../models/Testimonial");
const ApiError = require("../utils/ApiError");

const ALLOWED = ["name", "text", "image", "designation", "course", "rating", "order", "isActive"];
const pick = (body) =>
  Object.fromEntries(ALLOWED.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

const findById = async (id) => {
  const t = mongoose.isValidObjectId(id) ? await Testimonial.findById(id) : null;
  if (!t) throw new ApiError(404, "Testimonial not found");
  return t;
};

// GET /api/testimonials            -> active ones only (website)
// GET /api/testimonials/admin      -> all of them (dashboard, req.includeInactive)
const list = async (req, res) => {
  const filter = req.includeInactive ? {} : { isActive: true };
  const testimonials = await Testimonial.find(filter).sort({ order: 1, createdAt: -1 });
  res.json({ success: true, count: testimonials.length, testimonials });
};

// POST /api/testimonials  (admin)
const create = async (req, res) => {
  const testimonial = await Testimonial.create(pick(req.body));
  res.status(201).json({ success: true, testimonial });
};

// PATCH /api/testimonials/:id  (admin)
const update = async (req, res) => {
  const testimonial = await findById(req.params.id);
  testimonial.set(pick(req.body));
  await testimonial.save();
  res.json({ success: true, testimonial });
};

// DELETE /api/testimonials/:id  (admin)
const remove = async (req, res) => {
  const testimonial = await findById(req.params.id);
  await testimonial.deleteOne();
  res.json({ success: true, message: "Testimonial deleted" });
};

module.exports = { list, create, update, remove };