const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: { type: Number, required: true },
  feeType: {
    type: String,
    enum: ['monthly', 'semester', 'annual', 'late_fee'],
    required: true,
  },
  description: { type: String, default: '' },
  dueDate: { type: Date, required: true },
  paidDate: { type: Date },
  receiptNo: { type: String },
  status: {
    type: String,
    enum: ['pending', 'paid', 'overdue'],
    default: 'pending',
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Fee', feeSchema);
