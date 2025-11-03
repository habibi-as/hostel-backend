// models/ChatMessage.js
import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    seen: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true } // Automatically adds createdAt & updatedAt
);

// Index for faster queries (optional, useful in chat)
chatMessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });

const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);
export default ChatMessage;
