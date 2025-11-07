import express from "express";
import Attendance from "../models/attendance.js";
import Fee from "../models/Fee.js";
import Complaint from "../models/Complaint.js";
import Event from "../models/Event.js";
import { authenticateToken, requireAnyRole } from "../middleware/auth.js";

const router = express.Router();

/* ======================================
   🎓 STUDENT DASHBOARD STATS
====================================== */
router.get("/stats", authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const userId = req.user.id;

    // ✅ Attendance (total & present)
    const totalDays = await Attendance.countDocuments({ student: userId });
    const presentDays = await Attendance.countDocuments({
      student: userId,
      status: "present",
    });
    const attendancePercentage =
      totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    // ✅ Pending Fees
    const pendingFees = await Fee.find({
      student: userId,
      status: "pending",
    }).sort({ dueDate: 1 });

    // ✅ Complaints
    const complaints = await Complaint.find({ student: userId }).sort({
      createdAt: -1,
    });

    // ✅ Upcoming Events (next 7 days)
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const upcomingEvents = await Event.find({
      eventDate: { $gte: today, $lte: nextWeek },
      isActive: true,
    }).sort({ eventDate: 1 });

    res.json({
      success: true,
      data: {
        attendancePercentage,
        pendingFees: pendingFees.length,
        complaintsTotal: complaints.length,
        complaintsPending: complaints.filter((c) => c.status === "pending").length,
        upcomingEvents,
      },
    });
  } catch (error) {
    console.error("Student Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch student dashboard stats",
    });
  }
});

export default router;
