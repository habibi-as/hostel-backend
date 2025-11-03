// models/MaintenanceRequest.js
import mongoose from "mongoose";

const maintenanceRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    roomNo: {
      type: String,
      required: true,
      trim: true,
    },
    issueType: {
      type: String,
      enum: ["plumbing", "electrical", "furniture", "cleaning", "other"],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["pending", "assigned", "in_progress", "completed", "cancelled"],
      default: "pending",
    },
    assignedTo: {
      type: String,
      default: null,
      trim: true,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

const MaintenanceRequest = mongoose.model("MaintenanceRequest", maintenanceRequestSchema);
export default MaintenanceRequest;
