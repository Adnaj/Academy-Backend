// Bulk-import FAQs (per course) and testimonials from the data files.
//
//   node src/scripts/importContent.js --dry-run         preview only, no DB connection
//   node src/scripts/importContent.js                   import FAQs + testimonials
//   node src/scripts/importContent.js --faqs            FAQs only
//   node src/scripts/importContent.js --testimonials    testimonials only
//   node src/scripts/importContent.js --with-general    also add the "general" FAQs of each course
//
// FAQs         : online_courses  <- courseFaqs[courseKey].online   (offline_courses <- .offline)
//                matched by courseKey, `faqs` is REPLACED. Re-running is safe.
// Testimonials : matched by name (update if it exists, insert if not). Re-running is safe.
//
// To change content: edit src/data/faqContent.mjs / src/data/testimonialsContent.mjs and run again.

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const withGeneral = args.has("--with-general");
const doFaqs = args.has("--faqs") || !args.has("--testimonials");
const doTestimonials = args.has("--testimonials") || !args.has("--faqs");

const MAX_Q = 300; // same limits as the Course / Testimonial models
const MAX_A = 3000;
const MAX_NAME = 80;
const MAX_TEXT = 1500;

const toFaq = ({ q, a }, where) => {
  if (!q || !a) throw new Error(`${where}: empty question or answer`);
  if (q.length > MAX_Q) throw new Error(`${where}: question too long (${q.length}/${MAX_Q})`);
  if (a.length > MAX_A) throw new Error(`${where}: answer too long (${a.length}/${MAX_A})`);
  return { question: q.trim(), answer: a.trim() };
};

const importFaqs = async ({ OnlineCourse, OfflineCourse }) => {
  const { getCourseFaqs } = await import("../data/faqContent.mjs");
  const { courseDetailContent } = await import("../data/courseDetailContent.mjs");
  const models = { online: OnlineCourse, offline: OfflineCourse };

  for (const mode of ["online", "offline"]) {
    const ops = [];
    for (const courses of Object.values(courseDetailContent[mode])) {
      for (const [courseKey, course] of Object.entries(courses)) {
        const set = getCourseFaqs(courseKey, course.label); // { general, online, offline }
        const items = [...(withGeneral ? set.general : []), ...set[mode]];
        const faqs = items.map((f, i) => toFaq(f, `${mode}/${courseKey} #${i + 1}`));
        ops.push({ updateOne: { filter: { courseKey }, update: { $set: { faqs } } } });
        console.log(`  ${mode.padEnd(7)} ${courseKey.padEnd(38)} ${faqs.length} FAQs`);
      }
    }
    if (dryRun) continue;
    const r = await models[mode].bulkWrite(ops);
    console.log(`${mode}: matched ${r.matchedCount}, updated ${r.modifiedCount} of ${ops.length} courses`);
    if (r.matchedCount < ops.length)
      console.warn(`  ! ${ops.length - r.matchedCount} course(s) not found in DB - run the course seed first`);
  }
};

const importTestimonials = async (Testimonial) => {
  const { testimonialsData } = await import("../data/testimonialsContent.mjs");
  const ops = testimonialsData.map((t, i) => {
    const name = t.name?.trim();
    const text = t.text?.trim();
    if (!name || !text) throw new Error(`testimonial #${i + 1}: name/text missing`);
    if (name.length > MAX_NAME) throw new Error(`testimonial "${name}": name too long`);
    if (text.length > MAX_TEXT) throw new Error(`testimonial "${name}": text too long (${text.length}/${MAX_TEXT})`);
    return {
      updateOne: {
        filter: { name },
        update: {
          $set: { name, text, order: i, isActive: true, ...(t.image && { image: t.image }), ...(t.course && { course: t.course }) },
          $setOnInsert: { designation: t.designation || "Student", rating: t.rating ?? 5 },
        },
        upsert: true,
      },
    };
  });
  console.log(`  ${ops.length} testimonials`);
  if (dryRun) return;
  const r = await Testimonial.bulkWrite(ops);
  console.log(`testimonials: ${r.upsertedCount} new, ${r.modifiedCount} updated`);
};

const run = async () => {
  if (dryRun) console.log("DRY RUN - nothing is written\n");
  let models = {}, Testimonial;
  if (!dryRun) {
    const mongoose = require("mongoose");
    const env = require("../config/env");
    models = require("../models/Course");
    Testimonial = require("../models/Testimonial");
    await mongoose.connect(env.mongoUri);
    console.log("MongoDB connected");
  }
  if (doFaqs) { console.log("FAQs:"); await importFaqs(models); }
  if (doTestimonials) { console.log("Testimonials:"); await importTestimonials(Testimonial); }
  if (!dryRun) await require("mongoose").disconnect();
  console.log("Done");
};

run().catch((err) => {
  console.error("Import failed:", err.message);
  process.exit(1);
});