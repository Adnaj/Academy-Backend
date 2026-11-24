const mongoose = require("mongoose");
const { Schema } = mongoose;

const slugify = (s = "") =>
    String(s)
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const formatDate = (d) =>
    `${MONTHS[d.getUTCMonth()]} - ${String(d.getUTCDate()).padStart(2, "0")} - ${d.getUTCFullYear()}`;

// One block of the article body:
//   { type: "p" | "h3" | "quote", text }   or   { type: "list", items: [] }
const blockSchema = new Schema(
    {
        type: { type: String, enum: ["p", "h3", "list", "quote"], required: true },
        text: { type: String, trim: true },
        items: { type: [{ type: String, trim: true }], default: undefined },
    },
    { _id: false }
);

blockSchema.pre("validate", function () {
    if (!this.type) return; // the "required" rule already reports this
    if (this.type === "list") {
        if (!this.items || !this.items.length) this.invalidate("items", "A list block needs at least one item");
    } else if (!this.text) {
        this.invalidate("text", `A "${this.type}" block needs text`);
    }
});

const authorSchema = new Schema(
    { name: String, role: String, image: String, avatar: String },
    { _id: false }
);

const blogSchema = new Schema(
    {
        title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
        slug: { type: String, required: true, unique: true, trim: true, set: slugify },
        categoryRef: { type: Schema.Types.ObjectId, ref: "BlogCategory", required: true, index: true },
        category: { type: String, required: true, trim: true }, // "Career"  (copied from the BlogCategory)
        categorySlug: { type: String, index: true }, // "career"  (copied from the BlogCategory)
        image: { type: String, trim: true }, // banner + card image
        excerpt: { type: String, trim: true, maxlength: 500, default: "" },
        content: { type: [blockSchema], default: [] },
        author: { type: authorSchema, default: undefined },
        tags: { type: [{ type: String, trim: true }], default: [] },
        publishedAt: { type: Date, default: Date.now },
        isPublished: { type: Boolean, default: true },
    },
    {
        timestamps: true,
        toJSON: {
            transform: (doc, ret) => {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                if (ret.publishedAt) ret.date = formatDate(new Date(ret.publishedAt)); // "Feb - 20 - 2026"
                ret.filters = [ret.categorySlug]; // used by the filter buttons on /blog
                return ret;
            },
        },
    }
);

blogSchema.index({ isPublished: 1, publishedAt: -1 });

blogSchema.pre("validate", function () {
    if (!this.slug && this.title) this.slug = slugify(this.title);
 
});

module.exports = mongoose.model("Blog", blogSchema);