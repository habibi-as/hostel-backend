const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceSession', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD for easy queries
  status: { type: String, enum: ['present', 'late', 'absent'], required: true },
  checkInTime: { type: String }, // HH:MM:SS
  createdAt: { type: Date, default: Date.now }
});

// ensure one record per user per session
attendanceRecordSchema.index({ session: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
