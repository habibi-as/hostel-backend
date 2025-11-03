const express = require("express");
const { body, validationResult } = require("express-validator");
const { authenticateToken, requireAdmin, requireAnyRole } = require("../middleware/auth");
const LaundryRequest = require("../models/LaundryRequest");
const User = require("../models/user");

const router = express.Router();

/**
 * @route   GET /api/laundry
 * @desc    Get all laundry requests (students see only their own)
 * @access  Admin + Student
 */
router.get("/", authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const currentUser = req.user;
    const query = {};

    if (status) query.status = status;
    if (currentUser.role === "student") {
      query.user = currentUser.id;
    }

    const requests = await LaundryRequest.find(query)
      .populate("user", "name email roomNo")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ success: true, data: requests });
  } catch (error) {
    console.error("Get laundry requests error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch laundry requests",
    });
  }
});

/**
 * @route   POST /api/laundry
 * @desc    Create new laundry request (students)
 * @access  Student
 */
router.post(
  "/",
  authenticateToken,
  requireAnyRole,
  [
    body("requestType")
      .isIn(["wash", "iron", "dry_clean"])
      .withMessage("Invalid request type"),
    body("itemsCount")
      .isInt({ min: 1 })
      .withMessage("Items count must be at least 1"),
    body("pickupDate").isISO8601().withMessage("Valid pickup date is required"),
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

      const { requestType, itemsCount, pickupDate } = req.body;
      const userId = req.user.id;

      const newRequest = new LaundryRequest({
        user: userId,
        requestType,
        itemsCount,
        pickupDate,
        status: "pending",
      });

      await newRequest.save();

      res.status(201).json({
        success: true,
        message: "Laundry request submitted successfully",
        data: newRequest,
      });
    } catch (error) {
      console.error("Create laundry request error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit laundry request",
      });
    }
  }
);

/**
 * @route   PUT /api/laundry/:id/status
 * @desc    Update laundry request status (admin only)
 * @access  Admin
 */
router.put(
  "/:id/status",
  authenticateToken,
  requireAdmin,
  [
    body("status")
      .isIn(["pending", "picked_up", "processing", "ready", "delivered"])
      .withMessage("Invalid status"),
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

      const { id } = req.params;
      const { status, totalAmount, deliveryDate } = req.body;

      const updateData = { status };
      if (totalAmount) updateData.totalAmount = totalAmount;
      if (status === "delivered" && deliveryDate) updateData.deliveryDate = deliveryDate;

      const updated = await LaundryRequest.findByIdAndUpdate(id, updateData, { new: true });

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "Laundry request not found",
        });
      }

      res.json({
        success: true,
        message: "Laundry request status updated successfully",
        data: updated,
      });
    } catch (error) {
      console.error("Update laundry request error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update laundry request",
      });
    }
  }
);

export default router;

