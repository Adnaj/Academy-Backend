const mongoose = require("mongoose");

const testimonialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    text: { type: String, required: true, trim: true, maxlength: 1500 },
    image: { type: String, trim: true }, // student photo (optional, the frontend falls back to a default avatar)
    designation: { type: String, trim: true, default: "Student", maxlength: 80 },
    course: { type: String, trim: true, maxlength: 120 }, // optional, e.g. "Digital Marketing"
    rating: { type: Number, min: 0, max: 5, default: 5 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model("Testimonial", testimonialSchema);