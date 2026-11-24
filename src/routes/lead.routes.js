const express = require("express");
const forms = require("../config/leadForms");
const { makeLeadController, makeSummary } = require("../controllers/lead.controller");
const validate = require("../middleware/validate");
const { protect, restrictTo } = require("../middleware/auth");
const { leadLimiter } = require("../middleware/rateLimiter");
const { leadUpdateSchema } = require("../validators/lead.validator");

const router = express.Router();
const admin = [protect, restrictTo("admin")];

router.get("/summary", ...admin, makeSummary(forms));

// one router per form: /api/leads/contact, /guidance, /popup, /online-course, /offline-course
for (const form of forms) {
  const c = makeLeadController(form);
  const r = express.Router();

  r.post("/", leadLimiter, validate(form.schema), c.create); // public (website form)

  r.get("/", ...admin, c.list);
  r.get("/:id", ...admin, c.get);
  r.patch("/:id", ...admin, validate(leadUpdateSchema), c.update);
  r.delete("/:id", ...admin, c.remove);

  router.use(`/${form.key}`, r);
}

module.exports = router;