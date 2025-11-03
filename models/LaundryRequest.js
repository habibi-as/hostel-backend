// models/LaundryRequest.js
import mongoose from "mongoose";

const laundryRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestType: {
      type: String,
      enum: ["wash", "iron", "dry_clean"],
      required: true,
    },
    itemsCount: {
      type: Number,
      min: 1,
      required: true,
    },
    pickupDate: {
      type: Date,
      required: true,
    },
    deliveryDate: {
      type: Date,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "picked_up", "processing", "ready", "delivered"],
      default: "pending",
    },
  },
  {
    timestamps: true, // ✅ Automatically adds createdAt & updatedAt
  }
);

const LaundryRequest = mongoose.model("LaundryRequest", laundryRequestSchema);
export default LaundryRequest;
