const express = require("express");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// @route   POST api/auth/register
// @desc    Register a new user
// @access  Public
router.post("/register", authController.register);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post("/login", authController.login);

// @route   POST api/auth/logout
// @desc    Logout user (clear cookie)
// @access  Private (though technically can be called by anyone, cookie clearing is main goal)
router.post("/logout", authController.logout);

// @route   GET api/auth/user/profile
// @desc    Get user profile
// @access  Private
router.get("/user/profile", authMiddleware, authController.getProfile);

module.exports = router;

