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

    // Students can only generate their own QR code
    if (currentUser.role === 'student' && parseInt(userId) !== currentUser.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if user exists
    const [users] = await db.promise().execute(
      'SELECT id, name, email FROM users WHERE id = ? AND is_active = TRUE',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    const qrData = {
      userId: user.id,
      name: user.name,
      email: user.email,
      timestamp: new Date().toISOString()
    };

    // Generate QR code
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    res.json({
      success: true,
      data: {
        qrCode: qrCodeDataURL,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      }
    });

  } catch (error) {
    console.error('Generate QR code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate QR code'
    });
  }
});

// Mark attendance
router.post('/mark', authenticateToken, requireAnyRole, [
  body('qrData').notEmpty().withMessage('QR data is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { qrData } = req.body;
    const currentUser = req.user;

    // Parse QR data
    let parsedQrData;
    try {
      parsedQrData = JSON.parse(qrData);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code data'
      });
    }

    // Verify QR data
    if (!parsedQrData.userId || !parsedQrData.name || !parsedQrData.email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code format'
      });
    }

    // Check if QR code is for current user (students can only mark their own attendance)
    if (currentUser.role === 'student' && parsedQrData.userId !== currentUser.id) {
      return res.status(403).json({
        success: false,
        message: 'QR code does not belong to you'
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().split(' ')[0];

    // Check if attendance already marked for today
    const [existingAttendance] = await db.promise().execute(
      'SELECT id FROM attendance WHERE user_id = ? AND date = ?',
      [parsedQrData.userId, today]
    );

    if (existingAttendance.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked for today'
      });
    }

    // Determine if late (assuming 8:00 AM is the standard time)
    const isLate = currentTime > '08:00:00';
    const status = isLate ? 'late' : 'present';

    // Mark attendance
    await db.promise().execute(
      'INSERT INTO attendance (user_id, date, status, check_in_time) VALUES (?, ?, ?, ?)',
      [parsedQrData.userId, today, status, currentTime]
    );

    res.json({
      success: true,
      message: 'Attendance marked successfully',
      data: {
        status,
        time: currentTime,
        isLate
      }
    });

  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance'
    });
  }
});

// Get attendance records
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { userId, startDate, endDate, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const currentUser = req.user;

    // Students can only view their own attendance
    const targetUserId = currentUser.role === 'admin' ? userId : currentUser.id;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    let query = `
      SELECT a.*, u.name, u.email 
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE a.user_id = ?
    `;
    let params = [targetUserId];

    if (startDate) {
      query += ' AND a.date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND a.date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY a.date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [attendance] = await db.promise().execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM attendance WHERE user_id = ?';
    let countParams = [targetUserId];

    if (startDate) {
      countQuery += ' AND date >= ?';
      countParams.push(startDate);
    }

    if (endDate) {
      countQuery += ' AND date <= ?';
      countParams.push(endDate);
    }

    const [countResult] = await db.promise().execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        attendance,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance records'
    });
  }
});

// Get attendance statistics
router.get('/stats/:userId', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    const currentUser = req.user;

    // Students can only view their own stats
    const targetUserId = currentUser.role === 'admin' ? userId : currentUser.id;

    let query = `
      SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days
      FROM attendance 
      WHERE user_id = ?
    `;
    let params = [targetUserId];

    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    const [stats] = await db.promise().execute(query, params);

    const totalDays = stats[0].total_days;
    const presentDays = stats[0].present_days;
    const absentDays = stats[0].absent_days;
    const lateDays = stats[0].late_days;

    const attendancePercentage = totalDays > 0 ? ((presentDays + lateDays) / totalDays * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        totalDays,
        presentDays,
        absentDays,
        lateDays,
        attendancePercentage: parseFloat(attendancePercentage)
      }
    });

  } catch (error) {
    console.error('Get attendance stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance statistics'
    });
  }
});

// Get monthly attendance report
router.get('/monthly/:userId', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { userId } = req.params;
    const { year, month } = req.query;
    const currentUser = req.user;

    // Students can only view their own report
    const targetUserId = currentUser.role === 'admin' ? userId : currentUser.id;

    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;

    const [attendance] = await db.promise().execute(`
      SELECT 
        DATE(date) as date,
        status,
        check_in_time,
        check_out_time
      FROM attendance 
      WHERE user_id = ? 
        AND YEAR(date) = ? 
        AND MONTH(date) = ?
      ORDER BY date
    `, [targetUserId, targetYear, targetMonth]);

    // Get user info
    const [users] = await db.promise().execute(
      'SELECT name, email, batch FROM users WHERE id = ?',
      [targetUserId]
    );

    res.json({
      success: true,
      data: {
        user: users[0],
        year: targetYear,
        month: targetMonth,
        attendance
      }
    });

  } catch (error) {
    console.error('Get monthly attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly attendance'
    });
  }
});

// Get all students attendance (Admin only)
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;

    if (currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { date, batch, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        a.*,
        u.name,
        u.email,
        u.batch,
        u.room_no
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE u.role = 'student' AND u.is_active = TRUE
    `;
    let params = [];

    if (date) {
      query += ' AND a.date = ?';
      params.push(date);
    }

    if (batch) {
      query += ' AND u.batch = ?';
      params.push(batch);
    }

    query += ' ORDER BY a.date DESC, u.name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [attendance] = await db.promise().execute(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE u.role = 'student' AND u.is_active = TRUE
    `;
    let countParams = [];

    if (date) {
      countQuery += ' AND a.date = ?';
      countParams.push(date);
    }

    if (batch) {
      countQuery += ' AND u.batch = ?';
      countParams.push(batch);
    }

    const [countResult] = await db.promise().execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        attendance,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get all attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance records'
    });
  }
});

// Mark attendance manually (Admin only)
router.post('/manual', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;

    if (currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { userId, date, status, checkInTime, checkOutTime } = req.body;

    // Check if attendance already exists
    const [existingAttendance] = await db.promise().execute(
      'SELECT id FROM attendance WHERE user_id = ? AND date = ?',
      [userId, date]
    );

    if (existingAttendance.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked for this date'
      });
    }

    // Mark attendance
    await db.promise().execute(
      'INSERT INTO attendance (user_id, date, status, check_in_time, check_out_time) VALUES (?, ?, ?, ?, ?)',
      [userId, date, status, checkInTime, checkOutTime]
    );

    res.json({
      success: true,
      message: 'Attendance marked successfully'
    });

  } catch (error) {
    console.error('Manual attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance'
    });
  }
});

module.exports = router;
