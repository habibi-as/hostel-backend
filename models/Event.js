const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  eventDate: {
    type: Date,
    required: true
  },
  eventTime: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  eventType: {
    type: String,
    enum: ['academic', 'cultural', 'sports', 'social', 'maintenance'],
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Event', eventSchema);
