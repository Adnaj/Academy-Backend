const express = require("express");
const c = require("../controllers/blogCategory.controller");
const { protect, restrictTo } = require("../middleware/auth");

const router = express.Router();

router.get("/", c.list);
router.get("/:key", c.get);
router.post("/", protect, restrictTo("admin"), c.create);
router.patch("/:key", protect, restrictTo("admin"), c.update);
router.delete("/:key", protect, restrictTo("admin"), c.remove);

module.exports = router;