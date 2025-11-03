// models/LostFound.js
import mongoose from "mongoose";

const lostFoundSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["electronics", "clothing", "books", "accessories", "other"],
      required: true,
    },
    locationFound: {
      type: String,
      trim: true,
    },
    image: {
      type: String, // filename or URL
    },
    status: {
      type: String,
      enum: ["reported", "claimed", "unclaimed"],
      default: "reported",
    },
    claimedBy: {
      type: String, // can be student name or ID
      trim: true,
    },
    claimedAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // ✅ Automatically adds createdAt & updatedAt
  }
);

const LostFound = mongoose.model("LostFound", lostFoundSchema);
export default LostFound;
