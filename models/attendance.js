const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['present', 'late', 'absent'],
    default: 'present',
  },
  check_in_time: {
    type: String,
  },
  check_out_time: {
    type: String,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
