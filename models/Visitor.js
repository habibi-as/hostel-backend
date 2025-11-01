const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  contact: {
    type: String,
    required: true,
  },
  purpose: {
    type: String,
    required: true,
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  remarks: {
    type: String,
  },
  checkInTime: {
    type: Date,
    default: Date.now,
  },
  checkOutTime: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['checked_in', 'checked_out'],
    default: 'checked_in',
  },
});

module.exports = mongoose.model('Visitor', visitorSchema);
