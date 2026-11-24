const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");

const Career = require("../models/Career");
const ApiError = require("../utils/ApiError");
const validate = require("../middleware/validate");
const { protect, restrictTo } = require("../middleware/auth");
const { leadLimiter } = require("../middleware/rateLimiter");
const { sendCareerEmail } = require("../utils/sendEmail");
const { careerSchema, careerUpdateSchema } = require("../validators/career.validator");

// NOT inside /uploads (that folder is public). CVs are personal data: only admins can download them.
const CV_DIR = path.join(__dirname, "../../uploads-private/cvs");
const MAX_CV_MB = 5;

const TYPES = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

// check the real bytes, not just the mime type the browser claims
const matchesSignature = (buf, mime) => {
  switch (mime) {
    case "application/pdf":
      return buf.subarray(0, 5).toString() === "%PDF-";
    case "application/msword": // old .doc (OLE container)
      return buf.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": // .docx = zip
      return buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
    default:
      return false;
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CV_MB * 1024 * 1024, files: 1 },
});

const parseCv = (req, res, next) => {
  upload.single("cv")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") return next(new ApiError(400, `File size must not exceed ${MAX_CV_MB} MB.`));
    if (err.code === "LIMIT_UNEXPECTED_FILE") return next(new ApiError(400, 'Send the file under the field name "cv"'));
    next(new ApiError(400, err.message || "Upload failed"));
  });
};

const checkCv = (req, res, next) => {
  const file = req.file;
  if (!file) return next(new ApiError(400, "Please attach your CV."));
  if (!TYPES[file.mimetype]) return next(new ApiError(400, "Please upload a PDF, DOC or DOCX file."));
  if (!matchesSignature(file.buffer, file.mimetype)) return next(new ApiError(400, "File content does not match its type."));
  next();
};

const safeName = (s) => String(s).replace(/[^\w.-]+/g, "_").slice(0, 60) || "applicant";

const router = express.Router();
const admin = [protect, restrictTo("admin")];

/* ---------------- public: POST /api/careers  (multipart/form-data) ---------------- */
router.post("/", leadLimiter, parseCv, checkCv, validate(careerSchema), async (req, res) => {
  const file = req.file;
  const ext = TYPES[file.mimetype]; // extension comes from the checked type, never from the original filename
  const stored = `${crypto.randomBytes(12).toString("hex")}${ext}`;

  await fs.mkdir(CV_DIR, { recursive: true });
  await fs.writeFile(path.join(CV_DIR, stored), file.buffer);

  let application;
  try {
    application = await Career.create({
      ...req.body,
      cvFile: stored,
      cvOriginalName: file.originalname.slice(0, 200),
      cvSize: file.size,
    });
  } catch (err) {
    await fs.unlink(path.join(CV_DIR, stored)).catch(() => {}); // don't leave an orphan file
    throw err;
  }

  res.status(201).json({
    success: true,
    message: "Application received successfully! Our team will contact you if your profile matches.",
  });

  // email AFTER saving, never blocks / breaks the response (same idea as the lead forms)
  (async () => {
    try {
      await sendCareerEmail({
        application,
        attachment: { filename: `${safeName(application.fullName)}_CV${ext}`, content: file.buffer },
      });
      await Career.updateOne({ _id: application._id }, { emailSent: true });
    } catch (err) {
      console.error("Career email failed:", err.message);
      await Career.updateOne({ _id: application._id }, { emailError: String(err.message).slice(0, 300) }).catch(() => {});
    }
  })();
});

/* ---------------- admin ---------------- */
const find = async (id) => {
  const doc = mongoose.isValidObjectId(id) ? await Career.findById(id) : null;
  if (!doc) throw new ApiError(404, "Application not found");
  return doc;
};
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const str = (v) => (typeof v === "string" ? v.trim() : "");

// GET /api/careers?status=new&position=&search=&page=1&limit=20
router.get("/", ...admin, async (req, res) => {
  const filter = {};
  for (const key of ["status", "position", "experience"]) {
    const v = str(req.query[key]);
    if (v) filter[key] = v;
  }
  const q = str(req.query.search);
  if (q) {
    filter.$or = ["fullName", "email", "phone", "position"].map((f) => ({ [f]: { $regex: escapeRegex(q), $options: "i" } }));
  }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const [applications, total, newCount] = await Promise.all([
    Career.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Career.countDocuments(filter),
    Career.countDocuments({ status: "new" }),
  ]);
  res.json({ success: true, count: applications.length, total, newCount, page, pages: Math.ceil(total / limit), applications });
});

router.get("/:id", ...admin, async (req, res) => {
  res.json({ success: true, application: await find(req.params.id) });
});

// GET /api/careers/:id/cv  -> downloads the CV (send the Bearer token, e.g. fetch + blob)
router.get("/:id/cv", ...admin, async (req, res) => {
  const doc = await find(req.params.id);
  const file = path.join(CV_DIR, path.basename(doc.cvFile));
  await fs.access(file).catch(() => {
    throw new ApiError(404, "CV file not found");
  });
  res.download(file, `${safeName(doc.fullName)}_CV${path.extname(doc.cvFile)}`);
});

router.patch("/:id", ...admin, validate(careerUpdateSchema), async (req, res) => {
  const doc = await find(req.params.id);
  doc.set(req.body);
  await doc.save();
  res.json({ success: true, application: doc });
});

router.delete("/:id", ...admin, async (req, res) => {
  const doc = await find(req.params.id);
  await fs.unlink(path.join(CV_DIR, path.basename(doc.cvFile))).catch(() => {});
  await doc.deleteOne();
  res.json({ success: true, message: "Application deleted" });
});

module.exports = router;