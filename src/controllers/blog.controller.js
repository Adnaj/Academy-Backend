const mongoose = require("mongoose");
const Blog = require("../models/Blog");
const BlogCategory = require("../models/BlogCategory");
const ApiError = require("../utils/ApiError");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// slug or id
const byKey = (key) =>
  mongoose.isValidObjectId(key) ? { $or: [{ slug: key }, { _id: key }] } : { slug: key };

const ALLOWED = ["title", "slug", "categoryRef", "category", "categorySlug", "image", "excerpt", "content", "author", "tags", "publishedAt", "isPublished"];
const pick = (body) =>
  Object.fromEntries(ALLOWED.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

// Links the post to a BlogCategory. `category` (name) and `categorySlug` are always copied from it.
// Send either `categorySlug` or `categoryRef` (the category id).
const applyCategory = async (body, { required }) => {
  delete body.category; // never trusted from the client
  const { categoryRef, categorySlug } = body;

  if (!categoryRef && !categorySlug) {
    if (required) throw new ApiError(400, "categorySlug is required");
    return; // update without a category change
  }

  const cat = categoryRef
    ? await BlogCategory.findById(categoryRef)
    : await BlogCategory.findOne({ slug: categorySlug });
  if (!cat) throw new ApiError(400, `Blog category not found: ${categoryRef || categorySlug}`);

  body.categoryRef = cat._id;
  body.categorySlug = cat.slug;
  body.category = cat.name;
};

// public routes only see published posts; the /admin routes set req.includeDrafts
const visible = (req) => (req.includeDrafts ? {} : { isPublished: true });

// GET /api/blogs?category=career&tag=growth&search=hr&page=1&limit=12   (list has no article body)
const list = async (req, res) => {
  const { category, tag, search } = req.query;
  const filter = { ...visible(req) };
  if (category) filter.categorySlug = String(category).toLowerCase();
  if (tag) filter.tags = { $regex: `^${escapeRegex(String(tag))}$`, $options: "i" };
  if (search) filter.title = { $regex: escapeRegex(String(search)), $options: "i" };

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));

  const [blogs, total] = await Promise.all([
    Blog.find(filter)
      .select("-content")
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Blog.countDocuments(filter),
  ]);
  res.json({ success: true, count: blogs.length, total, page, pages: Math.ceil(total / limit), blogs });
};

// GET /api/blogs/:key  -> full article
const get = async (req, res) => {
  const blog = await Blog.findOne({ ...byKey(req.params.key), ...visible(req) });
  if (!blog) throw new ApiError(404, "Blog post not found");
  res.json({ success: true, blog });
};

// GET /api/blogs/:key/related?limit=3  -> same category first, then the newest others
const related = async (req, res) => {
  const current = await Blog.findOne({ ...byKey(req.params.key), isPublished: true }).select("categorySlug");
  if (!current) throw new ApiError(404, "Blog post not found");

  const limit = Math.min(12, Math.max(1, parseInt(req.query.limit, 10) || 3));
  const base = { isPublished: true, _id: { $ne: current._id } };
  const sort = { publishedAt: -1, createdAt: -1 };

  const same = await Blog.find({ ...base, categorySlug: current.categorySlug }).select("-content").sort(sort).limit(limit);
  let blogs = same;
  if (same.length < limit) {
    const rest = await Blog.find({ ...base, categorySlug: { $ne: current.categorySlug } })
      .select("-content")
      .sort(sort)
      .limit(limit - same.length);
    blogs = [...same, ...rest];
  }
  res.json({ success: true, count: blogs.length, blogs });
};

// POST /api/blogs  (admin)
const create = async (req, res) => {
  await applyCategory(req.body, { required: true });
  const blog = await Blog.create(pick(req.body));
  res.status(201).json({ success: true, blog });
};

// PATCH /api/blogs/:key  (admin) - send only the fields you want to change
const update = async (req, res) => {
  const blog = await Blog.findOne(byKey(req.params.key));
  if (!blog) throw new ApiError(404, "Blog post not found");
  await applyCategory(req.body, { required: false });
  blog.set(pick(req.body)); // the slug is NOT regenerated when the title changes (keeps old links working)
  await blog.save();
  res.json({ success: true, blog });
};

// DELETE /api/blogs/:key  (admin)
const remove = async (req, res) => {
  const blog = await Blog.findOneAndDelete(byKey(req.params.key));
  if (!blog) throw new ApiError(404, "Blog post not found");
  res.json({ success: true, message: "Blog post deleted" });
};

module.exports = { list, get, related, create, update, remove };