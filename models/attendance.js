import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
    },
    status: {
      type: String,
      enum: ["present", "absent", "late", "on_leave"],
      default: "present",
    },
    checkIn: {
      type: String,
      default: null,
    },
    checkOut: {
      type: String,
      default: null,
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
    batch: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // auto adds createdAt and updatedAt
  }
);

// ✅ Prevent duplicate attendance for same user/date
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;

