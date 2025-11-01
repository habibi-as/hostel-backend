const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  contact: {
    type: String,
  },
  purpose: {
    type: String,
    required: true,
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // references the student visited
    required: true,
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
  remarks: {
    type: String,
    default: '',
  },
});

module.exports = mongoose.model('Visitor', visitorSchema);
