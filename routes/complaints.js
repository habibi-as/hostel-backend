// routes/complaints.js
import express from "express";
import { body, validationResult } from "express-validator";
import Complaint from "../models/Complaint.js";
import { authenticateToken, requireStudent, requireAdmin, requireAnyRole } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route GET /api/complaints
 * @desc Get all complaints (Admin/Warden) or user's own (Student)
 */
router.get("/", authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { role, id } = req.user;
    const { status, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (role === "student") filter.user = id;
    if (status) filter.status = status;

    const complaints = await Complaint.find(filter)
      .populate("user", "name email roomNo")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Complaint.countDocuments(filter);

    res.json({
      success: true,
      data: {
        complaints,
        pagination: { current: parseInt(page), pages: Math.ceil(total / limit), total },
      },
    });
  } catch (error) {
    console.error("Get complaints error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch complaints" });
  }
});

/**
 * @route POST /api/complaints
 * @desc Create a new complaint (Student only)
 */
router.post(
  "/",
  authenticateToken,
  requireStudent,
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("category")
      .isIn(["maintenance", "food", "cleaning", "discipline", "other"])
      .withMessage("Invalid complaint category"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { title, description, category } = req.body;
      const userId = req.user.id;

      const complaint = new Complaint({
        user: userId,
        title,
        description,
        category,
        status: "pending",
      });

      await complaint.save();

      res
        .status(201)
        .json({ success: true, message: "Complaint submitted successfully", data: complaint });
    } catch (error) {
      console.error("Create complaint error:", error);
      res.status(500).json({ success: false, message: "Failed to create complaint" });
    }
  }
);

/**
 * @route PUT /api/complaints/:id/status
 * @desc Update complaint status (Admin/Warden only)
 */
router.put(
  "/:id/status",
  authenticateToken,
  requireAdmin,
  [
    body("status")
      .isIn(["pending", "in_progress", "resolved", "rejected"])
      .withMessage("Invalid status value"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { id } = req.params;
      const { status } = req.body;

      const complaint = await Complaint.findById(id);
      if (!complaint)
        return res.status(404).json({ success: false, message: "Complaint not found" });

      complaint.status = status;
      await complaint.save();

      res.json({ success: true, message: "Complaint status updated", data: complaint });
    } catch (error) {
      console.error("Update complaint status error:", error);
      res.status(500).json({ success: false, message: "Failed to update complaint status" });
    }
  }
);

/**
 * @route DELETE /api/complaints/:id
 * @desc Delete complaint (Admin or the owner)
 */
router.delete("/:id", authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const complaint = await Complaint.findById(id);
    if (!complaint)
      return res.status(404).json({ success: false, message: "Complaint not found" });

    if (currentUser.role === "student" && complaint.user.toString() !== currentUser.id)
      return res.status(403).json({ success: false, message: "Access denied" });

    await complaint.deleteOne();

    res.json({ success: true, message: "Complaint deleted successfully" });
  } catch (error) {
    console.error("Delete complaint error:", error);
    res.status(500).json({ success: false, message: "Failed to delete complaint" });
  }
});

export default router;
