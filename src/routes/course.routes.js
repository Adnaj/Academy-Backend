const express = require("express");
const makeCourseController = require("../controllers/course.controller");
const { protect, restrictTo } = require("../middleware/auth");
const { OnlineCourse, OfflineCourse } = require("../models/Course");

const buildRouter = (Model) => {
  const c = makeCourseController(Model);
  const router = express.Router();

  router.get("/", c.list);
  router.get("/:key", c.get);
  router.post("/", protect, restrictTo("admin"), c.create);
  router.patch("/:key", protect, restrictTo("admin"), c.update);
  router.delete("/:key", protect, restrictTo("admin"), c.remove);

  return router;
};

const router = express.Router();
router.use("/online", buildRouter(OnlineCourse));
router.use("/offline", buildRouter(OfflineCourse));

module.exports = router;