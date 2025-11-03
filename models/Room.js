// models/Room.js
import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    room_no: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    type: {
      type: String,
      enum: ["single", "double", "triple", "quad"],
      required: true,
    },
    floor: {
      type: Number,
      default: 1,
    },
    occupied: {
      type: Number,
      default: 0,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    occupants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

const Room = mongoose.model("Room", roomSchema);
export default Room;
