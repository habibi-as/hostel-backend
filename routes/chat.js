const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

// Get chat messages
router.get('/messages', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { room = 'general', page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const [messages] = await db.promise().execute(`
      SELECT cm.*, u.name as sender_name, u.role as sender_role, u.photo
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.room = ?
      ORDER BY cm.created_at DESC
      LIMIT ? OFFSET ?
    `, [room, parseInt(limit), offset]);

    // Reverse to show oldest first
    messages.reverse();

    res.json({
      success: true,
      data: messages
    });

  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat messages'
    });
  }
});

// Send message
router.post('/send', authenticateToken, requireAnyRole, [
  body('message').notEmpty().withMessage('Message is required'),
  body('room').isIn(['general', 'announcements', 'support']).withMessage('Invalid room')
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

    const { message, room = 'general' } = req.body;
    const senderId = req.user.id;
    const isAdminMessage = req.user.role === 'admin';

    // Save message to database
    const [result] = await db.promise().execute(
      'INSERT INTO chat_messages (sender_id, message, room, is_admin_message) VALUES (?, ?, ?, ?)',
      [senderId, message, room, isAdminMessage]
    );

    // Get the saved message with user details
    const [savedMessage] = await db.promise().execute(`
      SELECT cm.*, u.name as sender_name, u.role as sender_role, u.photo
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.id = ?
    `, [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: savedMessage[0]
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

// Get chat rooms
router.get('/rooms', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const rooms = [
      {
        id: 'general',
        name: 'General Chat',
        description: 'General discussion room for all students',
        isActive: true
      },
      {
        id: 'announcements',
        name: 'Announcements',
        description: 'Official announcements and updates',
        isActive: true
      },
      {
        id: 'support',
        name: 'Support',
        description: 'Get help and support from admin',
        isActive: true
      }
    ];

    res.json({
      success: true,
      data: rooms
    });

  } catch (error) {
    console.error('Get chat rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat rooms'
    });
  }
});

// Get online users (Admin only)
router.get('/online-users', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;

    if (currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get active users (users who have sent messages in the last 24 hours)
    const [activeUsers] = await db.promise().execute(`
      SELECT DISTINCT u.id, u.name, u.email, u.role, u.photo, u.room_no
      FROM users u
      JOIN chat_messages cm ON u.id = cm.sender_id
      WHERE cm.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        AND u.is_active = TRUE
      ORDER BY u.name
    `);

    res.json({
      success: true,
      data: activeUsers
    });

  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch online users'
    });
  }
});

// Get chat statistics (Admin only)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;

    if (currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { startDate, endDate } = req.query;

    let query = `
      SELECT 
        COUNT(*) as total_messages,
        COUNT(DISTINCT sender_id) as active_users,
        SUM(CASE WHEN is_admin_message = TRUE THEN 1 ELSE 0 END) as admin_messages,
        SUM(CASE WHEN is_admin_message = FALSE THEN 1 ELSE 0 END) as student_messages
      FROM chat_messages
      WHERE 1=1
    `;
    let params = [];

    if (startDate) {
      query += ' AND DATE(created_at) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND DATE(created_at) <= ?';
      params.push(endDate);
    }

    const [stats] = await db.promise().execute(query, params);

    // Get messages by room
    const [roomStats] = await db.promise().execute(`
      SELECT 
        room,
        COUNT(*) as message_count
      FROM chat_messages
      WHERE 1=1
        ${startDate ? 'AND DATE(created_at) >= ?' : ''}
        ${endDate ? 'AND DATE(created_at) <= ?' : ''}
      GROUP BY room
      ORDER BY message_count DESC
    `, startDate && endDate ? [startDate, endDate] : []);

    // Get daily message count
    const [dailyStats] = await db.promise().execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as message_count
      FROM chat_messages
      WHERE 1=1
        ${startDate ? 'AND DATE(created_at) >= ?' : ''}
        ${endDate ? 'AND DATE(created_at) <= ?' : ''}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, startDate && endDate ? [startDate, endDate] : []);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        byRoom: roomStats,
        daily: dailyStats
      }
    });

  } catch (error) {
    console.error('Get chat stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat statistics'
    });
  }
});

// Delete message (Admin only)
router.delete('/messages/:id', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;

    if (currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { id } = req.params;

    // Check if message exists
    const [messages] = await db.promise().execute(
      'SELECT id FROM chat_messages WHERE id = ?',
      [id]
    );

    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Delete message
    await db.promise().execute('DELETE FROM chat_messages WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message'
    });
  }
});

// Clear chat room (Admin only)
router.delete('/rooms/:room/clear', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;

    if (currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { room } = req.params;

    // Clear all messages in the room
    const [result] = await db.promise().execute(
      'DELETE FROM chat_messages WHERE room = ?',
      [room]
    );

    res.json({
      success: true,
      message: `Cleared ${result.affectedRows} messages from ${room} room`
    });

  } catch (error) {
    console.error('Clear chat room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear chat room'
    });
  }
});

module.exports = router;
