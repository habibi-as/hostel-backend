const mongoose = require('mongoose');

const lostFoundSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  itemName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['electronics', 'clothing', 'books', 'accessories', 'other'],
    required: true
  },
  locationFound: {
    type: String,
    default: ''
  },
  image: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['reported', 'claimed', 'unclaimed'],
    default: 'reported'
  },
  claimedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  claimedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('LostFound', lostFoundSchema);
