const express = require("express");
const authRoutes = require("./auth.routes");

const router = express.Router();

router.use("/auth", authRoutes);
// router.use("/courses", courseRoutes);   <- add new route files here later

module.exports = router;
