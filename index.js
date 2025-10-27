const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();
const mongoose = require('mongoose');

// Import Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const roomRoutes = require('./routes/rooms');
const attendanceRoutes = require('./routes/attendance');
const feeRoutes = require('./routes/fees');
const complaintRoutes = require('./routes/complaints');
const noticeRoutes = require('./routes/notices');
const lostFoundRoutes = require('./routes/lostFound');
const chatRoutes = require('./routes/chat');
const announcementRoutes = require('./routes/announcements');
const foodMenuRoutes = require('./routes/foodMenu');
const laundryRoutes = require('./routes/laundry');
const visitorRoutes = require('./routes/visitors');
const maintenanceRoutes = require('./routes/maintenance');
const eventRoutes = require('./routes/events');
const feedbackRoutes = require('./routes/feedback');
const reportRoutes = require('./routes/reports');
const chatbotRoutes = require('./routes/chatbot');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// 🧠 Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));

// 🕒 Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// 🧩 Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 🗂️ Static Files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 🧬 MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err.message);
  process.exit(1);
});

// 🚀 Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/lost-found', lostFoundRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/food-menu', foodMenuRoutes);
app.use('/api/laundry', laundryRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/chatbot', chatbotRoutes);

// 💬 Socket.io for Real-time Chat
io.on('connection', (socket) => {
  console.log('🟢 User connected:', socket.id);

  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`📦 User ${socket.id} joined room: ${room}`);
  });

  socket.on('send-message', (data) => {
    io.to(data.room).emit('new-message', data);
  });

  socket.on('disconnect', () => {
    console.log('🔴 User disconnected:', socket.id);
  });
});

// ❗ Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 🚫 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// ⚙️ Start Server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = { app, io };
