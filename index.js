import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import http from "http";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cron from "node-cron";

// ✅ Middleware for auth & roles
import { authenticateToken, requireAdmin, requireStudent } from "./middleware/auth.js";

// ✅ Import route files
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import roomRoutes from "./routes/rooms.js";
import attendanceRoutes from "./routes/attendance.js";
import feeRoutes from "./routes/fees.js";
import complaintRoutes from "./routes/complaints.js";
import noticeRoutes from "./routes/notices.js";
import lostFoundRoutes from "./routes/lostFound.js";
import chatRoutes from "./routes/chat.js";
import announcementRoutes from "./routes/announcements.js";
import foodMenuRoutes from "./routes/foodMenu.js";
import laundryRoutes from "./routes/laundry.js";
import visitorRoutes from "./routes/visitors.js";
import maintenanceRoutes from "./routes/maintenance.js";
import eventRoutes from "./routes/events.js";
import feedbackRoutes from "./routes/feedback.js";
import reportRoutes from "./routes/reports.js";
import chatbotRoutes from "./routes/chatbot.js";
import profileRoutes from "./routes/profile.js"; // ✅ Student profile (fetch/update)

// ✅ Attendance auto-mark cron
import { markAbsentIfNoScan } from "./cron/attendanceCron.js";

// ✅ Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// ===============================
// ✅ SECURITY, CORS, AND RATE LIMIT
// ===============================

// ✅ Allowed frontend URLs
const allowedOrigins = [
  "https://asuraxhostel.netlify.app",
  "http://localhost:3000",
];

// ✅ CORS setup
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else {
      console.log("❌ Blocked by CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ✅ Helmet for security
app.use(helmet({ crossOriginResourcePolicy: false }));

// ✅ Rate limiter (protect API from abuse)
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests from this IP, please try again later.",
  })
);

// ✅ Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ===============================
// ✅ HEALTH & TEST ROUTES
// ===============================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🚀 Backend is live and configured correctly ✅",
  });
});

app.get("/api/test-cors", (req, res) => {
  res.json({
    success: true,
    message: "CORS is working fine 🚀",
    origin: req.headers.origin || "unknown",
  });
});

// ===============================
// ✅ ROUTES (MATCH FRONTEND)
// ===============================

// 🔑 Auth & Users
app.use("/api/auth", authRoutes);
app.use("/api/users", authenticateToken, userRoutes);

// 🏠 Core Modules
app.use("/api/rooms", authenticateToken, roomRoutes);
app.use("/api/attendance", authenticateToken, attendanceRoutes);
app.use("/api/fees", authenticateToken, requireStudent, feeRoutes);

// 🧾 Student-related
app.use("/api/profile", authenticateToken, requireStudent, profileRoutes);
app.use("/api/complaints", authenticateToken, requireStudent, complaintRoutes);
app.use("/api/food-menu", authenticateToken, foodMenuRoutes);
app.use("/api/laundry", authenticateToken, requireStudent, laundryRoutes);
app.use("/api/maintenance", authenticateToken, maintenanceRoutes);
app.use("/api/lost-found", authenticateToken, lostFoundRoutes);
app.use("/api/feedback", authenticateToken, feedbackRoutes);
app.use("/api/events", authenticateToken, eventRoutes);
app.use("/api/notices", authenticateToken, noticeRoutes);
app.use("/api/visitors", authenticateToken, visitorRoutes);

// 🧑‍💼 Admin-related
app.use("/api/announcements", authenticateToken, requireAdmin, announcementRoutes);
app.use("/api/reports", authenticateToken, requireAdmin, reportRoutes);
app.use("/api/chatbot", authenticateToken, chatbotRoutes);
app.use("/api/chat", authenticateToken, chatRoutes);

// ===============================
// ✅ 404 & ERROR HANDLING
// ===============================
app.use("*", (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Not allowed by CORS policy",
    });
  }
  console.error("🔥 Server Error:", err);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

// ===============================
// ✅ DAILY CRON JOB
// ===============================
cron.schedule("0 0 * * *", async () => {
  console.log("🕛 Running daily attendance check...");
  await markAbsentIfNoScan();
  console.log("✅ Attendance auto-update complete");
});

// ===============================
// ✅ DATABASE CONNECTION & SERVER START
// ===============================
const PORT = process.env.PORT || 10000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    console.log("🟢 Server initialized, waiting for Render port...");

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

server.on("error", (err) => console.error("❌ Server error:", err));

export default app;

