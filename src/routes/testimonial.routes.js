const express = require("express");
const c = require("../controllers/testimonial.controller");
const { protect, restrictTo } = require("../middleware/auth");

const router = express.Router();
const admin = [protect, restrictTo("admin")];

router.get("/", c.list);
router.get("/admin", ...admin, (req, res, next) => {
  req.includeInactive = true;
  next();
}, c.list);
router.post("/", ...admin, c.create);
router.patch("/:id", ...admin, c.update);
router.delete("/:id", ...admin, c.remove);

module.exports = router;