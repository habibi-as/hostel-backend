const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model
    required: true
  },
  category: {
    type: String,
    enum: ['food', 'maintenance', 'electricity', 'cleanliness', 'security', 'other'],
    required: true
  },
  title: {
    type: String,
    required: [true, 'Title is required']
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved', 'rejected'],
    default: 'pending'
  },
  adminResponse: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Complaint', ComplaintSchema);
