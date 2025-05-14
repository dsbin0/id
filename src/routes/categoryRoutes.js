const express = require("express");
const categoryController = require("../controllers/categoryController");
const authMiddleware = require("../middleware/authMiddleware"); // Assuming category routes should be protected

const router = express.Router();

// @route   GET api/categories
// @desc    Get all investment categories
// @access  Private (user must be logged in)
router.get("/", authMiddleware, categoryController.getAllCategories);

// @route   GET api/categories/:id
// @desc    Get a specific investment category by ID
// @access  Private
router.get("/:id", authMiddleware, categoryController.getCategoryById);

module.exports = router;

