const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const { authenticateToken, requireAdmin, requireStudent } = require('../middleware/auth');
require('dotenv').config();

// 🧱 Register (for both admin and student)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, batch, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'All required fields must be filled' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ success: false, message: 'User already exists' });

    // Create user
    const newUser = new User({
      name,
      email,
      password,
      phone,
      batch: role === 'student' ? batch : null,
      role
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} registered successfully!`,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (err) {
    console.error('❌ Registration error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

// 🔑 Login (works for both admin & student)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ success: false, message: 'Invalid credentials' });

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: `${user.role} login successful`,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// 👤 Get user profile (auth required)
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, user });
  } catch (err) {
    console.error('❌ Profile fetch error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching profile' });
  }
});

// 🧩 Admin-only route example
router.get('/admin/dashboard', authenticateToken, requireAdmin, (req, res) => {
  res.json({
    success: true,
    message: 'Welcome Admin! This route is protected and only for admins.',
    user: req.user
  });
});

// 🎓 Student-only route example
router.get('/student/dashboard', authenticateToken, requireStudent, (req, res) => {
  res.json({
    success: true,
    message: 'Welcome Student! This route is protected and only for students.',
    user: req.user
  });
});

module.exports = router;
