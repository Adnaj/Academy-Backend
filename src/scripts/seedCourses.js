const mongoose = require("mongoose");
const env = require("../config/env");
const Category = require("../models/Category");
const { OnlineCourse, OfflineCourse } = require("../models/Course");

const run = async () => {
  const { courseDetailContent } = await import("../data/courseDetailContent.mjs");
  await mongoose.connect(env.mongoUri);
  console.log("MongoDB connected");

  const models = { online: OnlineCourse, offline: OfflineCourse };
  const fresh = process.argv.includes("--fresh");
  const linkOnly = process.argv.includes("--link-only");

  // 1. categories (existing ones are left untouched, so admin edits are kept)
  const categories = {};
  let catOrder = 0;
  for (const mode of Object.keys(models)) {
    for (const [slug, courses] of Object.entries(courseDetailContent[mode])) {
      if (categories[slug]) continue;
      const first = Object.values(courses)[0];
      categories[slug] = await Category.findOneAndUpdate(
        { slug },
        { $setOnInsert: { name: first.category, order: catOrder++, isActive: true } },
        { upsert: true, new: true }
      );
    }
  }
  console.log(`categories: ${Object.keys(categories).length}`);

  // 2. courses
  for (const [mode, Model] of Object.entries(models)) {
    if (fresh) await Model.deleteMany({});

    // only link existing courses to categories, do not touch their content
    if (linkOnly) {
      for (const [slug, cat] of Object.entries(categories)) {
        await Model.updateMany(
          { categorySlug: slug },
          { $set: { categoryRef: cat._id, category: cat.name } }
        );
      }
      console.log(`${mode}: linked to categories`);
      continue;
    }

    let order = 0;
    const ops = [];
    for (const [categorySlug, courses] of Object.entries(courseDetailContent[mode])) {
      const cat = categories[categorySlug];
      for (const [courseKey, course] of Object.entries(courses)) {
        ops.push({
          updateOne: {
            filter: { courseKey },
            update: {
              $set: { ...course, categorySlug, category: cat.name, categoryRef: cat._id, order: order++ },
            },
            upsert: true,
          },
        });
      }
    }

    const result = await Model.bulkWrite(ops);
    console.log(`${mode}: ${ops.length} courses (${result.upsertedCount} new, ${result.modifiedCount} updated)`);
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});