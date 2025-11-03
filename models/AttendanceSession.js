// models/AttendanceSession.js
import mongoose from "mongoose";

const attendanceSessionSchema = new mongoose.Schema({
  title: { 
    type: String, 
    default: "Daily Attendance" 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  }, // Admin or warden
  startAt: { 
    type: Date, 
    required: true 
  }, // Session start time
  expiresAt: { 
    type: Date, 
    required: true 
  }, // Session expiry
  durationHours: { 
    type: Number, 
    default: 24 
  },
  lateAfterMinutes: { 
    type: Number, 
    default: 480 
  }, // 8 hours → used to mark 'late'
  active: { 
    type: Boolean, 
    default: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
});

const AttendanceSession = mongoose.model("AttendanceSession", attendanceSessionSchema);

export default AttendanceSession;
