const express = require("express");
const c = require("../controllers/blog.controller");
const { protect, restrictTo } = require("../middleware/auth");

const router = express.Router();
const admin = [protect, restrictTo("admin")];
const withDrafts = (req, res, next) => {
  req.includeDrafts = true;
  next();
};

// fixed paths first, so they are not taken as a :key
router.get("/admin", ...admin, withDrafts, c.list); // dashboard list: drafts included
router.get("/admin/:key", ...admin, withDrafts, c.get); // dashboard edit form: drafts included

router.get("/", c.list);
router.get("/:key", c.get);
router.get("/:key/related", c.related);
router.post("/", ...admin, c.create);
router.patch("/:key", ...admin, c.update);
router.delete("/:key", ...admin, c.remove);

module.exports = router;