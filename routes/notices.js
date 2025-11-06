// routes/notices.js
import express from "express";
import { body, validationResult } from "express-validator";
import Notice from "../models/Notice.js";
import { authenticateToken, requireAdmin, requireAnyRole } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route GET /api/notices
 * @desc Get all active notices (All roles)
 */
router.get("/", authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const query = search ? { title: { $regex: search, $options: "i" } } : {};

    const notices = await Notice.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Notice.countDocuments(query);

    res.json({
      success: true,
      data: {
        notices,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error("Get notices error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch notices" });
  }
});

/**
 * @route GET /api/notices/:id
 * @desc Get a single notice
 */
router.get("/:id", authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await Notice.findById(id);

    if (!notice)
      return res.status(404).json({ success: false, message: "Notice not found" });

    res.json({ success: true, data: notice });
  } catch (error) {
    console.error("Get notice error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch notice" });
  }
});

/**
 * @route POST /api/notices
 * @desc Create new notice (Admin only)
 */
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("content").notEmpty().withMessage("Content is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { title, content, priority } = req.body;

      const notice = new Notice({
        title,
        content,
        priority: priority || "normal",
        createdBy: req.user.id,
      });

      await notice.save();

      res
        .status(201)
        .json({ success: true, message: "Notice created successfully", data: notice });
    } catch (error) {
      console.error("Create notice error:", error);
      res.status(500).json({ success: false, message: "Failed to create notice" });
    }
  }
);

/**
 * @route PUT /api/notices/:id
 * @desc Update notice (Admin only)
 */
router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  [
    body("title").optional().notEmpty().withMessage("Title cannot be empty"),
    body("content").optional().notEmpty().withMessage("Content cannot be empty"),
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const notice = await Notice.findByIdAndUpdate(id, updates, { new: true });

      if (!notice)
        return res.status(404).json({ success: false, message: "Notice not found" });

      res.json({
        success: true,
        message: "Notice updated successfully",
        data: notice,
      });
    } catch (error) {
      console.error("Update notice error:", error);
      res.status(500).json({ success: false, message: "Failed to update notice" });
    }
  }
);

/**
 * @route DELETE /api/notices/:id
 * @desc Delete notice (Admin only)
 */
router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await Notice.findByIdAndDelete(id);

    if (!notice)
      return res.status(404).json({ success: false, message: "Notice not found" });

    res.json({ success: true, message: "Notice deleted successfully" });
  } catch (error) {
    console.error("Delete notice error:", error);
    res.status(500).json({ success: false, message: "Failed to delete notice" });
  }
});

export default router;
