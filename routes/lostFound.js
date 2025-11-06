// routes/lostFound.js
import express from "express";
import { body, validationResult } from "express-validator";
import LostFound from "../models/LostFound.js";
import { authenticateToken, requireAnyRole, requireAdmin, requireStudent } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route GET /api/lostfound
 * @desc Get all lost/found items (everyone can view)
 */
router.get("/", authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const items = await LostFound.find(filter)
      .populate("user", "name email roomNo")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await LostFound.countDocuments(filter);

    res.json({
      success: true,
      data: {
        items,
        pagination: { current: parseInt(page), pages: Math.ceil(total / limit), total },
      },
    });
  } catch (error) {
    console.error("Get lost/found items error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch lost/found items" });
  }
});

/**
 * @route POST /api/lostfound
 * @desc Report a lost or found item (Student only)
 */
router.post(
  "/",
  authenticateToken,
  requireStudent,
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("type").isIn(["lost", "found"]).withMessage("Type must be either 'lost' or 'found'"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { title, description, type, location, date } = req.body;

      const item = new LostFound({
        user: req.user.id,
        title,
        description,
        type,
        location,
        date: date ? new Date(date) : new Date(),
        status: "open",
      });

      await item.save();

      res.status(201).json({
        success: true,
        message: "Lost/Found item reported successfully",
        data: item,
      });
    } catch (error) {
      console.error("Create lost/found error:", error);
      res.status(500).json({ success: false, message: "Failed to report item" });
    }
  }
);

/**
 * @route PUT /api/lostfound/:id/status
 * @desc Update status of a report (Admin only)
 */
router.put(
  "/:id/status",
  authenticateToken,
  requireAdmin,
  [body("status").isIn(["open", "resolved", "closed"]).withMessage("Invalid status")],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const item = await LostFound.findById(id);
      if (!item) {
        return res.status(404).json({ success: false, message: "Item not found" });
      }

      item.status = status;
      await item.save();

      res.json({ success: true, message: "Status updated successfully", data: item });
    } catch (error) {
      console.error("Update lost/found status error:", error);
      res.status(500).json({ success: false, message: "Failed to update status" });
    }
  }
);

/**
 * @route DELETE /api/lostfound/:id
 * @desc Delete a lost/found record (Admin or owner)
 */
router.delete("/:id", authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const item = await LostFound.findById(id);
    if (!item)
      return res.status(404).json({ success: false, message: "Item not found" });

    // Only admin or the user who created it can delete
    if (currentUser.role !== "admin" && item.user.toString() !== currentUser.id) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    await item.deleteOne();
    res.json({ success: true, message: "Item deleted successfully" });
  } catch (error) {
    console.error("Delete lost/found error:", error);
    res.status(500).json({ success: false, message: "Failed to delete item" });
  }
});

export default router;
