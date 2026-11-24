const mongoose = require("mongoose");
const Category = require("../models/Category");
const { OnlineCourse, OfflineCourse } = require("../models/Course");
const { LIST_FIELDS } = require("./course.controller");
const ApiError = require("../utils/ApiError");

// slug ("accounting") or id
const byKey = (key) =>
  mongoose.isValidObjectId(key) ? { $or: [{ slug: key }, { _id: key }] } : { slug: key };

const findCategory = async (key) => {
  const category = await Category.findOne(byKey(key));
  if (!category) throw new ApiError(404, "Category not found");
  return category;
};

const ALLOWED = ["name", "slug", "description", "image", "order", "isActive"];
const pick = (body) =>
  Object.fromEntries(ALLOWED.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

const countFor = async (categoryId) => {
  const [online, offline] = await Promise.all([
    OnlineCourse.countDocuments({ categoryRef: categoryId }),
    OfflineCourse.countDocuments({ categoryRef: categoryId }),
  ]);
  return { online, offline, total: online + offline };
};

// course counts for every category in two queries
const countsByCategory = async () => {
  const group = [{ $group: { _id: "$categoryRef", n: { $sum: 1 } } }];
  const [on, off] = await Promise.all([OnlineCourse.aggregate(group), OfflineCourse.aggregate(group)]);
  const map = new Map();
  const add = (rows, mode) =>
    rows.forEach((r) => {
      const k = String(r._id);
      map.set(k, { ...(map.get(k) || { online: 0, offline: 0 }), [mode]: r.n });
    });
  add(on, "online");
  add(off, "offline");
  return map;
};

// GET /api/categories?active=true
const list = async (req, res) => {
  const filter = {};
  if (req.query.active !== undefined) filter.isActive = req.query.active === "true";

  const [categories, counts] = await Promise.all([
    Category.find(filter).sort({ order: 1, name: 1 }),
    countsByCategory(),
  ]);

  const data = categories.map((c) => {
    const n = counts.get(String(c._id)) || { online: 0, offline: 0 };
    return { ...c.toJSON(), courseCount: { ...n, total: n.online + n.offline } };
  });
  res.json({ success: true, count: data.length, categories: data });
};

// GET /api/categories/:key
const get = async (req, res) => {
  const category = await findCategory(req.params.key);
  res.json({ success: true, category: { ...category.toJSON(), courseCount: await countFor(category._id) } });
};

// GET /api/categories/:key/courses?mode=online|offline   (no mode = both)
const courses = async (req, res) => {
  const category = await findCategory(req.params.key);
  const { mode } = req.query;
  if (mode && !["online", "offline"].includes(mode)) {
    throw new ApiError(400, "mode must be online or offline");
  }

  const fetch = (Model) => Model.find({ categoryRef: category._id }).select(LIST_FIELDS).sort({ order: 1 });
  const result = { success: true, category: category.toJSON() };
  if (!mode || mode === "online") result.online = await fetch(OnlineCourse);
  if (!mode || mode === "offline") result.offline = await fetch(OfflineCourse);
  res.json(result);
};

// POST /api/categories  (admin)
const create = async (req, res) => {
  const category = await Category.create(pick(req.body));
  res.status(201).json({ success: true, category });
};

// PATCH /api/categories/:key  (admin)
const update = async (req, res) => {
  const category = await findCategory(req.params.key);
  category.set(pick(req.body));
  const renamed = category.isModified("name") || category.isModified("slug");
  await category.save();

  // keep the copied name/slug on every linked course in sync
  if (renamed) {
    const patch = { $set: { category: category.name, categorySlug: category.slug } };
    await Promise.all([
      OnlineCourse.updateMany({ categoryRef: category._id }, patch),
      OfflineCourse.updateMany({ categoryRef: category._id }, patch),
    ]);
  }
  res.json({ success: true, category });
};

// DELETE /api/categories/:key  (admin) - blocked while courses use it
const remove = async (req, res) => {
  const category = await findCategory(req.params.key);
  const { online, offline, total } = await countFor(category._id);
  if (total > 0) {
    throw new ApiError(
      409,
      `Cannot delete: ${online} online and ${offline} offline course(s) use this category. Move or delete them first`
    );
  }
  await category.deleteOne();
  res.json({ success: true, message: "Category deleted" });
};

module.exports = { list, get, courses, create, update, remove };