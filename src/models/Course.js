const mongoose = require("mongoose");
const { Schema } = mongoose;

const titleText = new Schema(
    { title: { type: String, required: true, trim: true }, text: { type: String, required: true } },
    { _id: false }
);

const labelText = new Schema(
    { label: { type: String, required: true, trim: true }, text: { type: String, required: true } },
    { _id: false }
);

const whyItem = new Schema(
    {
        icon: { type: String, required: true },
        title: { type: String, required: true },
        text: { type: String, required: true },
    },
    { _id: false }
);

// FAQ: one question + answer
const faqItem = new Schema(
    {
        question: { type: String, required: true, trim: true, maxlength: 300 },
        answer: { type: String, required: true, trim: true, maxlength: 3000 },
    },
    { _id: false }
);

// "Learn Online" / "Learn Offline" cards
const optionCard = new Schema(
    {  title: String, description: String, },
    { _id: false }
);

const learningOptionsSchema = new Schema(
    {
        online: optionCard,
        offline: optionCard,
    },
    { _id: false }
);

const req = { type: String, required: true, trim: true };

const buildCourseSchema = () =>
    new Schema(
        {
            courseKey: { ...req, unique: true }, // key in the data file, e.g. "gcc-accounting"
            slug: { ...req, unique: true }, // e.g. "gcc-accounting-online" (or an external URL)
            categoryRef: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
            categorySlug: { ...req, index: true }, // copied from the Category
            category: req, // copied from the Category (display name)
            label: req,
            duration: req,
            heading: req,
            summary: req,
            type: { ...req }, // "Certification"  (a field called `type` is fine when written like this)
            featured: { type: Boolean, default: false },
            order: { type: Number, default: 0 }, // keeps the order from the data file

            image: String,
            brochure: String,
            certificate: String,

            overviewTitle: req,
            overview: req,
            gain: [String],
            learn: [titleText],
            skills: [String],
            tools: [String],
            careers: [String],

            eligibilityTitle: String, // some courses have no eligibility section
            eligibility: [labelText],

            certificateTitle: req,
            certificateText: req,

            learningOptions: { type: learningOptionsSchema, required: false },

            whyTitle: req,
            whySubtitle: req,
            why: [whyItem],
            faqs: {
                type: [faqItem],
                validate: {
                    validator: (v) => Array.isArray(v) && v.length > 0,
                    message: "Add at least one FAQ",
                },
            },
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

// Two collections, same shape
const OnlineCourse = mongoose.model("OnlineCourse", buildCourseSchema(), "online_courses");
const OfflineCourse = mongoose.model("OfflineCourse", buildCourseSchema(), "offline_courses");

module.exports = { OnlineCourse, OfflineCourse };