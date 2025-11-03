// models/Event.js
import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    eventDate: {
      type: Date,
      required: true,
    },
    eventTime: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    eventType: {
      type: String,
      enum: ["academic", "cultural", "sports", "social", "maintenance"],
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// 🧩 Optional index to speed up dashboard/event filtering
eventSchema.index({ eventDate: 1, eventType: 1 });

const Event = mongoose.model("Event", eventSchema);
export default Event;
