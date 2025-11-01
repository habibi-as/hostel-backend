const mongoose = require('mongoose');

const attendanceSessionSchema = new mongoose.Schema({
  title: { type: String, default: 'Daily Attendance' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // admin/warden
  startAt: { type: Date, required: true }, // session start time
  expiresAt: { type: Date, required: true }, // session expiry
  durationHours: { type: Number, default: 24 },
  lateAfterMinutes: { type: Number, default: 480 }, // 8 hours -> used to mark 'late'
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
