const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
require("dotenv").config();
const mongoose = require("mongoose");

// Import Routes
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

// ✅ Frontend URLs allowed
const allowedOrigins = [
  "https://asuraxhostel.netlify.app", // your Netlify site
  "http://localhost:3000", // for local testing
];

// ✅ CORS Setup (permanent fix)
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ Helmet for security
app.use(helmet());

// ✅ Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

// ✅ Body Parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB Error:", err.message));

// ✅ API Routes
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

// ✅ Socket.io setup with CORS
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);
  socket.on("join-room", (room) => socket.join(room));
  socket.on("send-message", (data) => io.to(data.room).emit("new-message", data));
  socket.on("disconnect", () => console.log("🔴 User disconnected:", socket.id));
});

// ✅ Default route to check API status
app.get("/", (req, res) => {
  res.json({ success: true, message: "Backend is live and CORS configured ✅" });
});

// ✅ Error Handling
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
});

// ✅ 404
app.use("*", (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ✅ Start Server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = { app, io };
