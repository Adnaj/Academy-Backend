const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { protect, restrictTo } = require("../middleware/auth");
const ApiError = require("../utils/ApiError");

const UPLOAD_ROOT = path.join(__dirname, "../../uploads");
const MB = 1024 * 1024;

// what each folder accepts: allowed mime -> extension, plus max size
const FOLDERS = {
  "course-images": {
    types: { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" },
    maxSize: 2 * MB,
  },
  brochures: {
    types: { "application/pdf": ".pdf" },
    maxSize: 10 * MB,
  },
  certificates: {
    types: { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf" },
    maxSize: 2 * MB,
  },
   
  "blog-images": {
    types: { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" },
    maxSize: 5 * MB,
  },
  "testimonial-images": {
    types: { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" },
    maxSize: 2 * MB,
  },
};

// check the real file bytes, not just the mime type the client claims
const matchesSignature = (buf, mime) => {
  switch (mime) {
    case "image/jpeg":
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case "image/png":
      return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/webp":
      return buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
    case "application/pdf":
      return buf.subarray(0, 5).toString() === "%PDF-";
    default:
      return false;
  }
};

// memory storage so the order of "folder" / "file" in the form doesn't matter
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * MB, files: 1 } });

// run multer and turn its errors into ApiError (-> { success:false, message })
const parseFile = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") return next(new ApiError(400, "File is too large"));
    if (err.code === "LIMIT_UNEXPECTED_FILE") return next(new ApiError(400, 'Send the file under the field name "file"'));
    next(new ApiError(400, err.message || "Upload failed"));
  });
};

const router = express.Router();

router.post("/", protect, restrictTo("admin"), parseFile, async (req, res) => {
  const folder = req.body.folder;
  const rules = FOLDERS[folder];
  if (!rules) throw new ApiError(400, `folder must be one of: ${Object.keys(FOLDERS).join(", ")}`);
  if (!req.file) throw new ApiError(400, "No file uploaded");

  const ext = rules.types[req.file.mimetype];
  if (!ext) {
    const allowed = [...new Set(Object.values(rules.types))].join(", ");
    throw new ApiError(400, `Invalid file type. Allowed: ${allowed}`);
  }
  if (req.file.size > rules.maxSize) {
    throw new ApiError(400, `File is too large (max ${rules.maxSize / MB}MB)`);
  }
  if (!matchesSignature(req.file.buffer, req.file.mimetype)) {
    throw new ApiError(400, "File content does not match its type");
  }

  // random name; the extension comes from the validated mime type, never from the original filename
  const filename = `${crypto.randomBytes(12).toString("hex")}${ext}`;
  const dir = path.join(UPLOAD_ROOT, folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), req.file.buffer);

  res.status(201).json({ success: true, url: `/uploads/${folder}/${filename}` });
});

module.exports = router;
module.exports.UPLOAD_ROOT = UPLOAD_ROOT;