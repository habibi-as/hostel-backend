const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    enum: ['maintenance', 'food', 'room', 'electricity', 'other'],
    default: 'other'
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Complaint', complaintSchema);
