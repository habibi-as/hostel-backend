import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Announcement title is required"],
      trim: true,
      maxlength: 100,
    },
    message: {
      type: String,
      required: [true, "Announcement message is required"],
      trim: true,
      maxlength: 1000,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator (admin) ID is required"],
    },
    audience: {
      type: String,
      enum: ["all", "students", "staff", "wardens", "batch"],
      default: "all",
    },
    batch: {
      type: String,
      default: null, // Used only when audience === 'batch'
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// Auto-disable announcements after expiration
announcementSchema.pre("save", function (next) {
  if (this.expiresAt && this.expiresAt < new Date()) {
    this.isActive = false;
  }
  next();
});

const Announcement = mongoose.model("Announcement", announcementSchema);

export default Announcement;
