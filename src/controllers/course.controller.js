const ApiError = require("../utils/ApiError");
const Category = require("../models/Category");

// fields used by course cards / listing pages (the detail endpoint returns everything)
const LIST_FIELDS =
  "courseKey slug label category categorySlug categoryRef duration heading summary type image brochure certificate featured order";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// courseKey ("gcc-accounting") or slug ("gcc-accounting-online")
const byKeyOrSlug = (key) => ({ $or: [{ courseKey: key }, { slug: key }] });

// Links the course to a Category. `category` (name) and `categorySlug` are always copied from it.
// Send either `categorySlug` or `categoryRef` (the category id).
const applyCategory = async (body, { required }) => {
  delete body.category; // never trusted from the client
  const { categoryRef, categorySlug } = body;

  if (!categoryRef && !categorySlug) {
    if (required) throw new ApiError(400, "categorySlug is required");
    return; // update without a category change
  }

  const cat = categoryRef
    ? await Category.findById(categoryRef)
    : await Category.findOne({ slug: categorySlug });
  if (!cat) throw new ApiError(400, `Category not found: ${categoryRef || categorySlug}`);

  body.categoryRef = cat._id;
  body.categorySlug = cat.slug;
  body.category = cat.name;
};

const makeCourseController = (Model) => ({
  // GET /?category=accounting&featured=true&search=sap
  list: async (req, res) => {
    const { category, featured, search } = req.query;
    const filter = {};
    if (category) filter.categorySlug = String(category);
    if (featured !== undefined) filter.featured = featured === "true";
    if (search) filter.label = { $regex: escapeRegex(String(search)), $options: "i" };

    const courses = await Model.find(filter).select(LIST_FIELDS).sort({ order: 1 });
    res.json({ success: true, count: courses.length, courses });
  },

  // GET /:key  -> full course page data (categoryRef is expanded)
  get: async (req, res) => {
    const course = await Model.findOne(byKeyOrSlug(req.params.key)).populate(
      "categoryRef",
      "name slug description image"
    );
    if (!course) throw new ApiError(404, "Course not found");
    res.json({ success: true, course });
  },

  // POST /  (admin)
  create: async (req, res) => {
    await applyCategory(req.body, { required: true });
    const course = await Model.create(req.body);
    res.status(201).json({ success: true, course });
  },

  // PATCH /:key  (admin) - send only the fields you want to change
  update: async (req, res) => {
    await applyCategory(req.body, { required: false });
    const course = await Model.findOneAndUpdate(
      byKeyOrSlug(req.params.key),
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!course) throw new ApiError(404, "Course not found");
    res.json({ success: true, course });
  },

  // DELETE /:key  (admin)
  remove: async (req, res) => {
    const course = await Model.findOneAndDelete(byKeyOrSlug(req.params.key));
    if (!course) throw new ApiError(404, "Course not found");
    res.json({ success: true, message: "Course deleted" });
  },
});

makeCourseController.LIST_FIELDS = LIST_FIELDS;
module.exports = makeCourseController;