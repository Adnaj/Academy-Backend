const express = require("express");
const controller = require("../controllers/auth.controller");
const validate = require("../middleware/validate");
const { protect } = require("../middleware/auth");
const { authLimiter, refreshLimiter } = require("../middleware/rateLimiter");
const { signupSchema, loginSchema, verifySignupSchema } = require("../validators/auth.validator");

const router = express.Router();

router.post("/signup", authLimiter, validate(signupSchema), controller.signup);
router.post("/signup/verify", authLimiter, validate(verifySignupSchema), controller.verifySignup);
router.post("/login", authLimiter, validate(loginSchema), controller.login);
router.post("/refresh", refreshLimiter, controller.refresh);
router.post("/logout", controller.logout);
router.post("/logout-all", protect, controller.logoutAll);
router.get("/me", protect, controller.me);

module.exports = router;
