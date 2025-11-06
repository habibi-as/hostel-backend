// routes/announcements.js
import express from "express";
import { body, validationResult } from "express-validator";
import { authenticateToken, requireAdmin, requireAnyRole } from "../middleware/auth.js";
import Announcement from "../models/Announcement.js";
import User from "../models/user.js";

const router = express.Router();

/**
 * @route   GET /api/announcements
 * @desc    Get all announcements (students see active ones, admins see all)
 * @access  Admin + Student
 */
router.get("/", authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { page = 1, limit = 10, category = "", search = "" } = req.query;
    const currentUser = req.user;
    const query = {};

    if (currentUser.role === "student") {
      query.isActive = true; // Students only see active announcements
    }

    if (category) {
      query.category = category;
    }

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    const announcements = await Announcement.find(query)
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Announcement.countDocuments(query);

    res.json({
      success: true,
      data: announcements,
      pagination: {
        current: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Get announcements error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch announcements",
    });
  }
});

/**
 * @route   POST /api/announcements
 * @desc    Create new announcement (Admin only)
 * @access  Admin
 */
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("content").notEmpty().withMessage("Content is required"),
    body("category").optional().isIn(["general", "event", "maintenance", "alert"]),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { title, content, category = "general" } = req.body;
      const createdBy = req.user.id;

      const newAnnouncement = new Announcement({
        title,
        content,
        category,
        createdBy,
        isActive: true,
      });

      await newAnnouncement.save();

      res.status(201).json({
        success: true,
        message: "Announcement created successfully",
        data: newAnnouncement,
      });
    } catch (error) {
      console.error("Create announcement error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create announcement",
      });
    }
  }
);

/**
 * @route   PUT /api/announcements/:id
 * @desc    Update announcement (Admin only)
 * @access  Admin
 */
router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  [
    body("title").optional().notEmpty(),
    body("content").optional().notEmpty(),
    body("isActive").optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const updated = await Announcement.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "Announcement not found",
        });
      }

      res.json({
        success: true,
        message: "Announcement updated successfully",
        data: updated,
      });
    } catch (error) {
      console.error("Update announcement error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update announcement",
      });
    }
  }
);

/**
 * @route   DELETE /api/announcements/:id
 * @desc    Delete announcement (Admin only)
 * @access  Admin
 */
router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const deleted = await Announcement.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    res.json({
      success: true,
      message: "Announcement deleted successfully",
    });
  } catch (error) {
    console.error("Delete announcement error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete announcement",
    });
  }
});

/**
 * @route   GET /api/announcements/:id
 * @desc    Get single announcement by ID
 * @access  Admin + Student
 */
router.get("/:id", authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id).populate(
      "createdBy",
      "name email role"
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    if (req.user.role === "student" && !announcement.isActive) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.json({
      success: true,
      data: announcement,
    });
  } catch (error) {
    console.error("Get announcement by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch announcement",
    });
  }
});

export default router;


