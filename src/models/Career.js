const mongoose = require("mongoose");
const { Schema } = mongoose;
const STATUSES = require("../utils/leadStatuses");

const text = (max) => ({ type: String, trim: true, maxlength: max });

// One document per job application. The CV file itself is stored on disk (uploads-private/cvs),
// only its stored name is kept here.
const schema = new Schema(
  {
    fullName: { ...text(80), required: true },
    email: { ...text(120), required: true, lowercase: true },
    phone: { ...text(30), required: true },
    location: text(80),
    position: { ...text(120), required: true },
    experience: text(40),
    message: text(2000),

    cvFile: { type: String, required: true }, // stored file name, e.g. 9f3c...a1.pdf
    cvOriginalName: text(200),
    cvSize: Number,

    status: { type: String, enum: STATUSES, default: "new", index: true },
    adminNote: { ...text(1000), default: "" },
    emailSent: { type: Boolean, default: false },
    emailError: { type: String, default: "" },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.cvFile; // internal name is never sent to the client
        return ret;
      },
    },
  }
);
schema.index({ createdAt: -1 });

module.exports = mongoose.model("Career", schema, "career_applications");