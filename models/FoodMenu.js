// models/FoodMenu.js
const mongoose = require('mongoose');

const foodMenuSchema = new mongoose.Schema({
  dayOfWeek: {
    type: String,
    enum: [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    ],
    required: true
  },
  mealType: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner'],
    required: true
  },
  menuItems: {
    type: String, // could also be [String] if you want an array later
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('FoodMenu', foodMenuSchema);
