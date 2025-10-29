// index.js (or server.js)
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
require("dotenv").config();
const mongoose = require("mongoose");

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

// ✅ CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("❌ CORS blocked origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204
};

// ✅ Apply CORS before anything else
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Handle preflight

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
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB Error:", err.message));

// ✅ API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/fees", feeRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/lost-found", lostFoundRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/food-menu", foodMenuRoutes);
app.use("/api/laundry", laundryRoutes);
app.use("/api/visitors", visitorRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/chatbot", chatbotRoutes);

// ✅ Health check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Backend is live and CORS configured ✅"
  });
});

// ✅ CORS test route (for debugging)
app.get("/api/test-cors", (req, res) => {
  res.json({
    success: true,
    message: "CORS is working perfectly 🚀",
    origin: req.headers.origin || "unknown"
  });
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

// ✅ 404 route
app.use("*", (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ✅ Start server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = app;
