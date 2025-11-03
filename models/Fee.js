// models/Fee.js
import mongoose from "mongoose";

const feeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    feeType: {
      type: String,
      enum: ["monthly", "semester", "annual", "late_fee"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "overdue"],
      default: "pending",
    },
    dueDate: {
      type: Date,
      required: true,
    },
    paidDate: {
      type: Date,
    },
    receiptNo: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// 📅 Automatically mark as 'overdue' if dueDate < current date (optional helper)
feeSchema.pre("save", function (next) {
  if (this.status === "pending" && this.dueDate < new Date()) {
    this.status = "overdue";
  }
  next();
});

const Fee = mongoose.model("Fee", feeSchema);
export default Fee;
