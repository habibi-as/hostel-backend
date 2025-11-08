import express from "express";
import bcrypt from "bcryptjs";
import { body, validationResult } from "express-validator";
import { authenticateToken, requireAdmin, requireAnyRole, requireStudent } from "../middleware/auth.js";
import upload from "../middleware/upload.js";
import User from "../models/user.js";
import Room from "../models/Room.js";
import Complaint from "../models/Complaint.js";
import Fee from "../models/Fee.js";
import Laundry from "../models/laundry.js"; // ✅ Added for student stats

const router = express.Router();

// ✅ Get all users (Admin only)
router.get("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", role = "", batch = "" } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }
    if (role) query.role = role;
    if (batch) query.batch = batch;

    const users = await User.find(query)
      .select("name email role room_no batch phone photo is_active createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

// ✅ Get user by ID
router.get("/:id", authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole === "student" && id !== userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const user = await User.findById(id).select("-password");
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch user" });
  }
});

// ✅ Create user (Admin only)
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  [
    body("name").notEmpty(),
    body("email").isEmail(),
    body("password").isLength({ min: 6 }),
    body("role").isIn(["admin", "student"]),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { name, email, password, role, room_no, batch, phone } = req.body;

      const existing = await User.findOne({ email });
      if (existing)
        return res
          .status(400)
          .json({ success: false, message: "Email already exists" });

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await User.create({
        name,
        email,
        password: hashedPassword,
        role,
        room_no,
        batch,
        phone,
      });

      // Update room occupancy if assigned
      if (room_no) await Room.findOneAndUpdate({ room_no }, { $inc: { occupied: 1 } });

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: user,
      });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ success: false, message: "Failed to create user" });
    }
  }
);

// ✅ Update user
router.put("/:id", authenticateToken, upload.single("photo"), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole === "student" && id !== userId)
      return res.status(403).json({ success: false, message: "Access denied" });

    const { name, email, room_no, batch, phone, is_active } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (email) updates.email = email;
    if (batch) updates.batch = batch;
    if (phone) updates.phone = phone;
    if (req.file) updates.photo = req.file.filename;
    if (userRole === "admin" && is_active !== undefined) updates.is_active = is_active;
    if (room_no !== undefined) updates.room_no = room_no;

    const oldUser = await User.findById(id);
    if (!oldUser) return res.status(404).json({ success: false, message: "User not found" });

    // Update user
    await User.findByIdAndUpdate(id, updates, { new: true });

    // Handle room occupancy updates (Admin only)
    if (userRole === "admin" && room_no !== undefined) {
      if (oldUser.room_no) await Room.findOneAndUpdate({ room_no: oldUser.room_no }, { $inc: { occupied: -1 } });
      if (room_no) await Room.findOneAndUpdate({ room_no }, { $inc: { occupied: 1 } });
    }

    res.json({ success: true, message: "User updated successfully" });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ success: false, message: "Failed to update user" });
  }
});

// ✅ Delete user (Admin only)
router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    if (user.room_no)
      await Room.findOneAndUpdate({ room_no: user.room_no }, { $inc: { occupied: -1 } });

    await user.deleteOne();

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ success: false, message: "Failed to delete user" });
  }
});

// ✅ Dashboard stats (Admin only)
router.get("/stats/dashboard", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: "student", is_active: true });
    const totalRooms = await Room.countDocuments({ is_active: true });
    const occupiedRooms = await Room.countDocuments({ occupied: { $gt: 0 }, is_active: true });
    const pendingComplaints = await Complaint.countDocuments({ status: "pending" });
    const feesCollected = await Fee.aggregate([
      {
        $match: {
          status: "paid",
          paid_date: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    res.json({
      success: true,
      data: {
        totalStudents,
        totalRooms,
        occupiedRooms,
        pendingComplaints,
        feesCollected: feesCollected[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch stats" });
  }
});

// ✅ Student Dashboard Stats
router.get("/stats/student", authenticateToken, requireStudent, async (req, res) => {
  try {
    const userId = req.user.id;

    const [complaints, unpaidFees, laundryRequests] = await Promise.all([
      Complaint.countDocuments({ student: userId }),
      Fee.countDocuments({ student: userId, status: "unpaid" }),
      Laundry.countDocuments({ student: userId }),
    ]);

    res.json({
      success: true,
      data: {
        totalComplaints: complaints,
        pendingFees: unpaidFees,
        laundryCount: laundryRequests,
      },
    });
  } catch (error) {
    console.error("Student dashboard stats error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch student dashboard data" });
  }
});

// ✅ Get students by batch
router.get("/batch/:batch", authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { batch } = req.params;
    const students = await User.find({ batch, role: "student", is_active: true })
      .select("name email room_no phone photo")
      .sort({ name: 1 });

    res.json({ success: true, data: students });
  } catch (error) {
    console.error("Get batch students error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch students" });
  }
});

// ✅ Get roommates
router.get("/room/:roomNo/roommates", authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { roomNo } = req.params;
    const roommates = await User.find({ room_no: roomNo, role: "student", is_active: true })
      .select("name email phone photo")
      .sort({ name: 1 });

    res.json({ success: true, data: roommates });
  } catch (error) {
    console.error("Get roommates error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch roommates" });
  }
});

export default router;
