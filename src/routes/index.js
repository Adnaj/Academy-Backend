const express = require("express");
const authRoutes = require("./auth.routes");
const courseRoutes = require("./course.routes");
const categoryRoutes = require("./category.routes");
const uploadRoutes = require("./upload.routes");
const blogRoutes = require("./blog.routes");
const blogCategoryRoutes = require("./blogCategory.routes");
const testimonialRoutes = require("./testimonial.routes");
const leadRoutes = require("./lead.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/courses", courseRoutes);
router.use("/categories", categoryRoutes);
router.use("/uploads", uploadRoutes);
router.use("/blogs", blogRoutes);
router.use("/blog-categories", blogCategoryRoutes);
router.use("/testimonials", testimonialRoutes);
router.use("/leads", leadRoutes);

module.exports = router;