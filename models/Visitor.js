import mongoose from "mongoose";

const visitorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Visitor name is required"],
      trim: true,
    },
    contact: {
      type: String,
      required: [true, "Visitor contact number is required"],
      trim: true,
    },
    purpose: {
      type: String,
      required: [true, "Purpose of visit is required"],
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Linked to the student they’re visiting
      required: false,
    },
    checkInTime: {
      type: Date,
      default: Date.now,
    },
    checkOutTime: {
      type: Date,
    },
    remarks: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["checked_in", "checked_out"],
      default: "checked_in",
    },
  },
  {
    timestamps: true,
  }
);

const Visitor = mongoose.model("Visitor", visitorSchema);

export default Visitor;

