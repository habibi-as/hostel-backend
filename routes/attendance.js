const express = require('express');
const QRCode = require('qrcode');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

// Generate QR code for attendance
router.get('/qr/:userId', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;

    if (currentUser.role === 'student' && parseInt(userId) !== currentUser.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const [users] = await db.promise().execute(
      'SELECT id, name, email FROM users WHERE id = ? AND is_active = TRUE',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = users[0];
    const qrData = {
      userId: user.id,
      name: user.name,
      email: user.email,
      timestamp: new Date().toISOString()
    };

    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' }
    });

    res.json({
      success: true,
      data: { qrCode: qrCodeDataURL, user }
    });
  } catch (error) {
    console.error('Generate QR code error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate QR code' });
  }
});

// Mark attendance
router.post(
  '/mark',
  authenticateToken,
  requireAnyRole,
  [body('qrData').notEmpty().withMessage('QR data is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { qrData } = req.body;
      const currentUser = req.user;

      let parsedQrData;
      try {
        parsedQrData = JSON.parse(qrData);
      } catch {
        return res.status(400).json({ success: false, message: 'Invalid QR code data' });
      }

      if (!parsedQrData.userId || !parsedQrData.name || !parsedQrData.email) {
        return res.status(400).json({ success: false, message: 'Invalid QR code format' });
      }

      if (currentUser.role === 'student' && parsedQrData.userId !== currentUser.id) {
        return res.status(403).json({ success: false, message: 'QR code does not belong to you' });
      }

      const today = new Date().toISOString().split('T')[0];
      const currentTime = new Date().toTimeString().split(' ')[0];

      const [existing] = await db.promise().execute(
        'SELECT id FROM attendance WHERE user_id = ? AND date = ?',
        [parsedQrData.userId, today]
      );

      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: 'Already marked for today' });
      }

      const isLate = currentTime > '08:00:00';
      const status = isLate ? 'late' : 'present';

      await db.promise().execute(
        'INSERT INTO attendance (user_id, date, status, check_in_time) VALUES (?, ?, ?, ?)',
        [parsedQrData.userId, today, status, currentTime]
      );

      res.json({
        success: true,
        message: 'Attendance marked successfully',
        data: { status, time: currentTime, isLate }
      });
    } catch (error) {
      console.error('Mark attendance error:', error);
      res.status(500).json({ success: false, message: 'Failed to mark attendance' });
    }
  }
);

module.exports = router;
