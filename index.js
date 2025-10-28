const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const socketIo = require("socket.io");
require("dotenv").config();
const mongoose = require("mongoose");

// ✅ Import Routes
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

// ✅ Allowed frontend origins
const allowedOrigins = [
  "https://asuraxhostel.netlify.app",
  "http://localhost:3000",
];

// ✅ Fix: Universal CORS middleware (handles preflight + headers manually)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// ✅ Helmet (must come AFTER custom CORS headers)
app.use(helmet({ crossOriginResourcePolicy: false }));

// ✅ Rate Limiter
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  })
);

// ✅ Body Parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ✅ MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB Error:", err.message));

// ✅ Routes
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

// ✅ Socket.io setup
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);
  socket.on("join-room", (room) => socket.join(room));
  socket.on("send-message", (data) => io.to(data.room).emit("new-message", data));
  socket.on("disconnect", () => console.log("🔴 Socket disconnected:", socket.id));
});

// ✅ Health Check
app.get("/", (req, res) => {
  res.json({ success: true, message: "Backend online ✅ (CORS fixed)" });
});

// ✅ Error Handler
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({ success: false, message: err.message || "Server error" });
});

// ✅ 404 Handler
app.use("*", (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ✅ Start Server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = { app, io };
