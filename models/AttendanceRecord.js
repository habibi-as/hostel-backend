import mongoose from "mongoose";

const attendanceRecordSchema = new mongoose.Schema({
  session: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "AttendanceSession", 
    required: true 
  },
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  date: { 
    type: String, 
    required: true // Format: YYYY-MM-DD for easy queries
  },
  status: { 
    type: String, 
    enum: ["present", "late", "absent"], 
    required: true 
  },
  checkInTime: { 
    type: String // Format: HH:MM:SS
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
});

// ✅ Ensure one record per user per session
attendanceRecordSchema.index({ session: 1, user: 1 }, { unique: true });

const AttendanceRecord = mongoose.model("AttendanceRecord", attendanceRecordSchema);

export default AttendanceRecord;
