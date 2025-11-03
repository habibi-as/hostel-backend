// models/Complaint.js
import mongoose from "mongoose";

const complaintSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      enum: ["maintenance", "food", "room", "electricity", "other"],
      default: "other",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "resolved"],
      default: "pending",
    },
  },
  { timestamps: true } // adds createdAt & updatedAt automatically
);

// 🧩 Index for faster lookup by user or status
complaintSchema.index({ user: 1, status: 1 });

const Complaint = mongoose.model("Complaint", complaintSchema);
export default Complaint;
