// models/Feedback.js
import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    serviceType: {
      type: String,
      enum: ["food", "cleaning", "security", "maintenance", "overall"],
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    comment: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// 📊 Optional: Prevent duplicate feedback per user per service type
feedbackSchema.index({ user: 1, serviceType: 1 }, { unique: true });

const Feedback = mongoose.model("Feedback", feedbackSchema);
export default Feedback;
