const mongoose = require("mongoose");
const { Schema } = mongoose;
const STATUSES = require("../utils/leadStatuses");

// every lead form has these fields
const base = {
  name: { type: String, required: true, trim: true, maxlength: 80 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  status: { type: String, enum: STATUSES, default: "new", index: true },
  adminNote: { type: String, trim: true, maxlength: 1000, default: "" },
  emailSent: { type: Boolean, default: false }, // was the notification email delivered?
  emailError: { type: String, default: "" },
};

const text = (max) => ({ type: String, trim: true, maxlength: max });

// one model (= one collection) per form
const makeLeadModel = (modelName, collection, fields) => {
  const schema = new Schema(
    { ...base, ...fields },
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
  schema.index({ createdAt: -1 });
  return mongoose.model(modelName, schema, collection);
};

// the Contact page form and the Guidance form send the same fields
const contactFields = {
  programme: text(120),
  mode: { type: String, enum: ["online", "offline"] },
  location: text(80), // only when mode is offline
  message: text(2000),
};

module.exports = {
  // 1. Contact page form
  ContactLead: makeLeadModel("ContactLead", "contact_leads", contactFields),

  // 2. "Get the right guidance" form
  GuidanceLead: makeLeadModel("GuidanceLead", "guidance_leads", contactFields),

  // 3. LeadPopup (Enquire now / Enrol now / Download brochure)
  PopupLead: makeLeadModel("PopupLead", "popup_leads", {
    formTitle: text(200), // e.g. "Enroll in GCC Accounting"
    source: { ...text(200), index: true }, // which button opened the popup
    course: text(200), // course slug
    courseTitle: text(200),
    category: text(120),
    studyMode: text(20),
    pageUrl: text(500),
    pagePath: text(300),
    meta: Schema.Types.Mixed, // cleaned copy of the popup's meta object
  }),

  // 4. "Request a Call Back" on ONLINE course pages
  OnlineCourseLead: makeLeadModel("OnlineCourseLead", "online_course_leads", {
    message: text(2000),
    courseTitle: text(200),
    pageUrl: text(500),
  }),

  // 5. "Request a Call Back" on OFFLINE course pages (has a campus location)
  OfflineCourseLead: makeLeadModel("OfflineCourseLead", "offline_course_leads", {
    message: text(2000),
    location: text(80), // campus
    courseTitle: text(200),
    pageUrl: text(500),
  }),
};