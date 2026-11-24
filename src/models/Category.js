const mongoose = require("mongoose");

const slugify = (s = "") =>
  String(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 80 },
    slug: { type: String, required: true, unique: true, trim: true, set: slugify }, // e.g. "accounting"
    description: { type: String, trim: true, default: "" },
    image: String,
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

// slug is optional on create: it is generated from the name
categorySchema.pre("validate", async function () {
  if (!this.slug && this.name) this.slug = slugify(this.name);
});

module.exports = mongoose.model("Category", categorySchema);