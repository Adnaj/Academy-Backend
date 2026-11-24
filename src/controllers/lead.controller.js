const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const { sendLeadEmail } = require("../utils/sendEmail");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const str = (v) => (typeof v === "string" ? v.trim() : ""); // ignore arrays / objects in the query string

const parseDate = (value, endOfDay) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, `Invalid date: ${value}`);
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) d.setUTCHours(23, 59, 59, 999);
  return d;
};

// Sends the notification email AFTER the lead is saved. It never throws: if the email fails the lead
// is still safe in the database, and the failure is stored on the lead (emailSent / emailError).
const notify = async (form, lead) => {
  try {
    const rows = form.fields.map(([key, label]) => [label, lead[key]]);
    await sendLeadEmail({ formLabel: form.label, name: lead.name, phone: lead.phone, rows, submittedAt: lead.createdAt });
    await form.Model.updateOne({ _id: lead._id }, { emailSent: true });
  } catch (err) {
    console.error(`Lead email failed (${form.key}):`, err.message);
    await form.Model.updateOne({ _id: lead._id }, { emailError: String(err.message).slice(0, 300) }).catch(() => {});
  }
};

const makeLeadController = (form) => {
  const { Model } = form;

  const find = async (id) => {
    const lead = mongoose.isValidObjectId(id) ? await Model.findById(id) : null;
    if (!lead) throw new ApiError(404, "Lead not found");
    return lead;
  };

  return {
    // POST /  (public) - req.body is already validated + cleaned by the form's zod schema
    create: async (req, res) => {
      const lead = await Model.create(req.body);
      res.status(201).json({ success: true, message: form.thanks });
      notify(form, lead); // not awaited: the visitor gets the answer straight away
    },

    // GET /?status=new&search=anu&from=2026-11-01&to=2026-11-30&page=1&limit=20  (+ this form's own filters)
    list: async (req, res) => {
      const filter = {};
      for (const key of ["status", ...form.filters]) {
        const v = str(req.query[key]);
        if (v) filter[key] = v;
      }

      const q = str(req.query.search);
      if (q) filter.$or = form.search.map((f) => ({ [f]: { $regex: escapeRegex(q), $options: "i" } }));

      const from = str(req.query.from);
      const to = str(req.query.to);
      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = parseDate(from, false);
        if (to) filter.createdAt.$lte = parseDate(to, true);
      }

      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

      const [leads, total, newCount] = await Promise.all([
        Model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        Model.countDocuments(filter),
        Model.countDocuments({ status: "new" }),
      ]);
      res.json({ success: true, count: leads.length, total, newCount, page, pages: Math.ceil(total / limit), leads });
    },

    // GET /:id
    get: async (req, res) => {
      res.json({ success: true, lead: await find(req.params.id) });
    },

    // PATCH /:id   { status?, adminNote? }
    update: async (req, res) => {
      const lead = await find(req.params.id);
      lead.set(req.body);
      await lead.save();
      res.json({ success: true, lead });
    },

    // DELETE /:id
    remove: async (req, res) => {
      const lead = await find(req.params.id);
      await lead.deleteOne();
      res.json({ success: true, message: "Lead deleted" });
    },
  };
};

// GET /api/leads/summary  -> number of NEW leads per form (dashboard badges)
const makeSummary = (forms) => async (req, res) => {
  const counts = await Promise.all(forms.map((f) => f.Model.countDocuments({ status: "new" })));
  const summary = Object.fromEntries(forms.map((f, i) => [f.key, counts[i]]));
  res.json({ success: true, summary, total: counts.reduce((a, b) => a + b, 0) });
};

module.exports = { makeLeadController, makeSummary };