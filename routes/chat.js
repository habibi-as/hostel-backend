// routes/chat.js
import express from "express";
import { body, validationResult } from "express-validator";
import { authenticateToken, requireAnyRole } from "../middleware/auth.js";
import ChatMessage from "../models/ChatMessage.js";
import User from "../models/user.js";

const router = express.Router();

/* ======================================
   🟢 GET CHAT MESSAGES (Paginated)
====================================== */
router.get("/messages", authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { room = "general", page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const messages = await ChatMessage.find({ room })
      .populate("sender", "name role")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error("Get chat messages error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch chat messages" });
  }
});

/* ======================================
   🟢 SEND MESSAGE
====================================== */
router.post(
  "/send",
  authenticateToken,
  requireAnyRole,
  [
    body("message").notEmpty().withMessage("Message is required"),
    body("room").isIn(["general", "announcements", "support"]).withMessage("Invalid room"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { message, room = "general" } = req.body;
      const senderId = req.user.id;
      const isAdminMessage = req.user.role === "admin";

      const newMessage = await ChatMessage.create({
        sender: senderId,
        message,
        room,
        isAdminMessage,
      });

      const populatedMessage = await newMessage.populate("sender", "name role");

      res.status(201).json({
        success: true,
        message: "Message sent successfully",
        data: populatedMessage,
      });
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ success: false, message: "Failed to send message" });
    }
  }
);

/* ======================================
   🟢 GET CHAT ROOMS
====================================== */
router.get("/rooms", authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const rooms = [
      { id: "general", name: "General Chat", description: "For all students", isActive: true },
      { id: "announcements", name: "Announcements", description: "Official updates", isActive: true },
      { id: "support", name: "Support", description: "Help from admins", isActive: true },
    ];
    res.json({ success: true, data: rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch chat rooms" });
  }
});

/* ======================================
   🟢 ONLINE USERS (Active last 24h)
====================================== */
router.get("/online-users", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Access denied" });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const activeUsers = await ChatMessage.find({ createdAt: { $gte: since } })
      .distinct("sender")
      .then(async (ids) => await User.find({ _id: { $in: ids } }, "name email role phone"));

    res.json({ success: true, data: activeUsers });
  } catch (error) {
    console.error("Online users error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch online users" });
  }
});

/* ======================================
   🟢 CHAT STATS (Admin only)
====================================== */
router.get("/stats", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Access denied" });

    const { startDate, endDate } = req.query;
    const filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const totalMessages = await ChatMessage.countDocuments(filter);
    const activeUsers = await ChatMessage.distinct("sender", filter);
    const adminMessages = await ChatMessage.countDocuments({ ...filter, isAdminMessage: true });
    const studentMessages = await ChatMessage.countDocuments({ ...filter, isAdminMessage: false });

    const roomStats = await ChatMessage.aggregate([
      { $match: filter },
      { $group: { _id: "$room", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const dailyStats = await ChatMessage.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 30 },
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalMessages,
          activeUsers: activeUsers.length,
          adminMessages,
          studentMessages,
        },
        byRoom: roomStats,
        daily: dailyStats,
      },
    });
  } catch (error) {
    console.error("Chat stats error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch chat stats" });
  }
});

/* ======================================
   🗑️ DELETE MESSAGE (Admin only)
====================================== */
router.delete("/messages/:id", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Access denied" });

    const deleted = await ChatMessage.findByIdAndDelete(req.params.id);

    if (!deleted)
      return res.status(404).json({ success: false, message: "Message not found" });

    res.json({ success: true, message: "Message deleted successfully" });
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({ success: false, message: "Failed to delete message" });
  }
});

/* ======================================
   🧹 CLEAR CHAT ROOM (Admin only)
====================================== */
router.delete("/rooms/:room/clear", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "Access denied" });

    const result = await ChatMessage.deleteMany({ room: req.params.room });

    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} messages from ${req.params.room}`,
    });
  } catch (error) {
    console.error("Clear chat room error:", error);
    res.status(500).json({ success: false, message: "Failed to clear chat room" });
  }
});

export default router;
