const { z } = require("zod");
const STATUSES = require("../utils/leadStatuses");

const name = z.string("Please enter your name").trim().min(2, "Please enter your name").max(80, "Name is too long");

const phone = z
  .string("Please enter your phone number")
  .trim()
  .refine((v) => {
    const digits = v.replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
  }, "Please enter a valid phone number");

const optionalText = (max) => z.string().trim().max(max).nullish();
const obj = (b) => (b && typeof b === "object" ? b : {});

/* ---- 1 + 2. Contact page form and Guidance form (same body) ----
   The forms send cfName / cfEmail (= the PHONE number) / cfSubject / cfMode / cfLocation / message.
   The cleaner names (name, phone, programme, mode, location) work too. */
const contactSchema = z.preprocess(
  (b) => {
    const x = obj(b);
    return {
      name: x.name ?? x.cfName,
      phone: x.phone ?? x.cfEmail,
      programme: x.programme ?? x.cfSubject,
      mode: x.mode ?? x.cfMode,
      location: x.location ?? x.cfLocation,
      message: x.message,
    };
  },
  z
    .object({
      name,
      phone,
      programme: optionalText(120),
      mode: z.string().trim().toLowerCase().pipe(z.enum(["online", "offline"], "Mode must be online or offline")).nullish(),
      location: optionalText(80),
      message: z.string("Please enter a note").trim().min(1, "Please enter a note").max(2000, "Note is too long"),
    })
    .refine((d) => d.mode !== "offline" || !!d.location, { message: "Please select a location", path: ["location"] })
    .transform((d) => ({
      name: d.name,
      phone: d.phone,
      programme: d.programme || undefined,
      mode: d.mode || undefined,
      location: d.mode === "offline" ? d.location : undefined, // location only counts for offline
      message: d.message,
    }))
);

/* ---- 3. LeadPopup ----
   { name, phone, formTitle, source, meta, pageUrl, pagePath, submittedAt } */

// keep only simple values with safe keys, so the stored "meta" stays small and clean
const cleanMeta = (meta) => {
  const out = {};
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return out;
  for (const [k, v] of Object.entries(meta).slice(0, 20)) {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(k)) continue;
    if (typeof v === "string") out[k] = v.trim().slice(0, 200);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
};

const popupSchema = z
  .object({
    name,
    phone,
    formTitle: optionalText(200),
    source: optionalText(200),
    pageUrl: optionalText(500),
    pagePath: optionalText(300),
    meta: z.any().optional(),
  })
  .transform((d) => {
    const meta = cleanMeta(d.meta);
    return {
      name: d.name,
      phone: d.phone,
      formTitle: d.formTitle || undefined,
      source: meta.source || d.source || "unknown",
      course: meta.course || undefined,
      courseTitle: meta.courseTitle || undefined,
      category: meta.category || undefined,
      studyMode: meta.studyMode || undefined,
      pageUrl: d.pageUrl || undefined,
      pagePath: d.pagePath || undefined,
      meta: Object.keys(meta).length ? meta : undefined,
    };
  });

/* ---- 4 + 5. "Request a Call Back" on the course pages ----
   Body: { name, phone, message, location (offline only), course (= course title), studyMode, source (= page URL) } */
const courseCallbackSchema = ({ needLocation }) =>
  z.preprocess(
    (b) => {
      const x = obj(b);
      return {
        name: x.name,
        phone: x.phone,
        message: x.message,
        location: x.location,
        courseTitle: x.courseTitle ?? x.course,
        pageUrl: x.pageUrl ?? x.source,
      };
    },
    z
      .object({
        name,
        phone,
        message: optionalText(2000),
        location: optionalText(80),
        courseTitle: optionalText(200),
        pageUrl: optionalText(500),
      })
      .refine((d) => !needLocation || !!d.location, { message: "Please select your campus location", path: ["location"] })
      .transform((d) => ({
        name: d.name,
        phone: d.phone,
        message: d.message || undefined,
        ...(needLocation && { location: d.location }),
        courseTitle: d.courseTitle || undefined,
        pageUrl: d.pageUrl || undefined,
      }))
  );

const onlineCourseSchema = courseCallbackSchema({ needLocation: false });
const offlineCourseSchema = courseCallbackSchema({ needLocation: true });

/* ---- admin: PATCH /api/leads/<form>/:id ---- */
const leadUpdateSchema = z
  .object({
    status: z.enum(STATUSES, `status must be one of: ${STATUSES.join(", ")}`).optional(),
    adminNote: z.string().trim().max(1000, "Note is too long").optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Send status and/or adminNote" });

module.exports = { contactSchema, popupSchema, onlineCourseSchema, offlineCourseSchema, leadUpdateSchema };