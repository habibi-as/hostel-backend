// 🧠 Student-specific attendance fetch
router.get("/student/:id", authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { id } = req.params;

    // Students can only view their own attendance
    if (req.user.role === "student" && req.user.id !== id) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const attendance = await Attendance.find({ student: id })
      .sort({ date: -1 })
      .limit(30); // last 30 records

    const total = attendance.length;
    const present = attendance.filter((a) => a.status === "present").length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalDays: total,
        presentDays: present,
        attendancePercentage: percentage,
        records: attendance,
      },
    });
  } catch (error) {
    console.error("Get student attendance error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch attendance" });
  }
});
