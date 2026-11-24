const mongoose = require("mongoose");
const BlogCategory = require("../models/BlogCategory");
const Blog = require("../models/Blog");
const ApiError = require("../utils/ApiError");

// slug ("career") or id
const byKey = (key) =>
  mongoose.isValidObjectId(key) ? { $or: [{ slug: key }, { _id: key }] } : { slug: key };

const findCategory = async (key) => {
  const category = await BlogCategory.findOne(byKey(key));
  if (!category) throw new ApiError(404, "Blog category not found");
  return category;
};

const ALLOWED = ["name", "slug", "description", "order", "isActive"];
const pick = (body) =>
  Object.fromEntries(ALLOWED.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

// GET /api/blog-categories?active=true
// postCount = published posts only (what the website sidebar shows)
const list = async (req, res) => {
  const filter = {};
  if (req.query.active !== undefined) filter.isActive = req.query.active === "true";

  const [categories, counts] = await Promise.all([
    BlogCategory.find(filter).sort({ order: 1, name: 1 }),
    Blog.aggregate([{ $match: { isPublished: true } }, { $group: { _id: "$categoryRef", n: { $sum: 1 } } }]),
  ]);
  const countMap = new Map(counts.map((r) => [String(r._id), r.n]));

  const data = categories.map((c) => ({ ...c.toJSON(), postCount: countMap.get(String(c._id)) || 0 }));
  res.json({ success: true, count: data.length, categories: data });
};

// GET /api/blog-categories/:key
const get = async (req, res) => {
  const category = await findCategory(req.params.key);
  const postCount = await Blog.countDocuments({ categoryRef: category._id, isPublished: true });
  res.json({ success: true, category: { ...category.toJSON(), postCount } });
};

// POST /api/blog-categories  (admin)
const create = async (req, res) => {
  const category = await BlogCategory.create(pick(req.body));
  res.status(201).json({ success: true, category });
};

// PATCH /api/blog-categories/:key  (admin)
const update = async (req, res) => {
  const category = await findCategory(req.params.key);
  category.set(pick(req.body));
  const renamed = category.isModified("name") || category.isModified("slug");
  await category.save();

  // keep the copied name/slug on every linked post in sync
  if (renamed) {
    await Blog.updateMany(
      { categoryRef: category._id },
      { $set: { category: category.name, categorySlug: category.slug } }
    );
  }
  res.json({ success: true, category });
};

// DELETE /api/blog-categories/:key  (admin) - blocked while posts use it
const remove = async (req, res) => {
  const category = await findCategory(req.params.key);
  const total = await Blog.countDocuments({ categoryRef: category._id });
  if (total > 0) {
    throw new ApiError(409, `Cannot delete: ${total} blog post(s) use this category. Move or delete them first`);
  }
  await category.deleteOne();
  res.json({ success: true, message: "Blog category deleted" });
};

module.exports = { list, get, create, update, remove };