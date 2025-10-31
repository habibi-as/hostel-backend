// index.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
require("dotenv").config();
const mongoose = require("mongoose");

// ✅ Middleware for auth & roles
const { authenticateToken, requireAdmin, requireStudent } = require("./middleware/auth");

// ✅ Import all route files
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const roomRoutes = require("./routes/rooms");
const attendanceRoutes = require("./routes/attendance");
const feeRoutes = require("./routes/fees");
const complaintRoutes = require("./routes/complaints");
const noticeRoutes = require("./routes/notices");
const lostFoundRoutes = require("./routes/lostFound");
const chatRoutes = require("./routes/chat");
const announcementRoutes = require("./routes/announcements");
const foodMenuRoutes = require("./routes/foodMenu");
const laundryRoutes = require("./routes/laundry");
const visitorRoutes = require("./routes/visitors");
const maintenanceRoutes = require("./routes/maintenance");
const eventRoutes = require("./routes/events");
const feedbackRoutes = require("./routes/feedback");
const reportRoutes = require("./routes/reports");
const chatbotRoutes = require("./routes/chatbot");

const app = express();
const server = http.createServer(app);

// ✅ Allowed frontend URLs (Netlify + local dev)
const allowedOrigins = [
  "https://asuraxhostel.netlify.app",
  "http://localhost:3000"
];

// ✅ Enhanced CORS handling (fixes preflight)
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("❌ Blocked by CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // ✅ handle all preflight requests

// ✅ Helmet for security
app.use(helmet({ crossOriginResourcePolicy: false }));

// ✅ Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

// ✅ Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ✅ MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB Error:", err.message));

// ✅ Health check route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🚀 Backend is live and CORS configured correctly ✅"
  });
});

// ✅ CORS test route
app.get("/api/test-cors", (req, res) => {
  res.json({
    success: true,
    message: "CORS is working fine 🚀",
    origin: req.headers.origin || "unknown"
  });
});


// ===============================
// ✅ ROUTE CONFIGURATION
// ===============================

// Public (no auth)
app.use("/api/auth", authRoutes); // Register / Login

// Student + Admin (Authenticated)
app.use("/api/users", authenticateToken, userRoutes);
app.use("/api/rooms", authenticateToken, roomRoutes);
app.use("/api/attendance", authenticateToken, requireStudent, attendanceRoutes); // Students only
app.use("/api/fees", authenticateToken, requireStudent, feeRoutes);
app.use("/api/complaints", authenticateToken, requireStudent, complaintRoutes);
app.use("/api/notices", authenticateToken, noticeRoutes);
app.use("/api/lost-found", authenticateToken, lostFoundRoutes);
app.use("/api/chat", authenticateToken, chatRoutes);
app.use("/api/announcements", authenticateToken, requireAdmin, announcementRoutes); // Admin only
app.use("/api/food-menu", authenticateToken, foodMenuRoutes);
app.use("/api/laundry", authenticateToken, requireStudent, laundryRoutes);
app.use("/api/visitors", authenticateToken, requireAdmin, visitorRoutes);
app.use("/api/maintenance", authenticateToken, requireAdmin, maintenanceRoutes);
app.use("/api/events", authenticateToken, eventRoutes);
app.use("/api/feedback", authenticateToken, feedbackRoutes);
app.use("/api/reports", authenticateToken, requireAdmin, reportRoutes);
app.use("/api/chatbot", authenticateToken, chatbotRoutes);

// ✅ 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Not allowed by CORS policy"
    });
  }
  console.error("🔥 Server Error:", err);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

// ✅ Start server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = app;
