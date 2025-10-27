const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

// Get announcements
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { type, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT a.*, u.name as created_by_name
      FROM announcements a
      JOIN users u ON a.created_by = u.id
      WHERE a.is_active = TRUE
    `;
    let params = [];

    if (type) {
      query += ' AND a.type = ?';
      params.push(type);
    }

    query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [announcements] = await db.promise().execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM announcements WHERE is_active = TRUE';
    let countParams = [];

    if (type) {
      countQuery += ' AND type = ?';
      countParams.push(type);
    }

    const [countResult] = await db.promise().execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        announcements,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements'
    });
  }
});

// Create announcement (Admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('title').notEmpty().withMessage('Title is required'),
  body('content').notEmpty().withMessage('Content is required'),
  body('type').isIn(['general', 'maintenance', 'event', 'emergency']).withMessage('Invalid type')
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

    const { title, content, type } = req.body;
    const createdBy = req.user.id;

    const [result] = await db.promise().execute(
      'INSERT INTO announcements (title, content, type, created_by) VALUES (?, ?, ?, ?)',
      [title, content, type, createdBy]
    );

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: {
        id: result.insertId,
        title,
        type
      }
    });

  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create announcement'
    });
  }
});

module.exports = router;
