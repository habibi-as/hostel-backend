const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

// Get feedback
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { serviceType, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT f.*, u.name, u.email, u.room_no
      FROM feedback f
      JOIN users u ON f.user_id = u.id
      WHERE 1=1
    `;
    let params = [];

    if (serviceType) {
      query += ' AND f.service_type = ?';
      params.push(serviceType);
    }

    query += ' ORDER BY f.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [feedback] = await db.promise().execute(query, params);

    res.json({
      success: true,
      data: feedback
    });

  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback'
    });
  }
});

// Submit feedback
router.post('/', authenticateToken, requireAnyRole, [
  body('serviceType').isIn(['food', 'cleaning', 'security', 'maintenance', 'overall']).withMessage('Invalid service type'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5')
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

    const { serviceType, rating, comment } = req.body;
    const userId = req.user.id;

    const [result] = await db.promise().execute(
      'INSERT INTO feedback (user_id, service_type, rating, comment) VALUES (?, ?, ?, ?)',
      [userId, serviceType, rating, comment]
    );

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: {
        id: result.insertId,
        serviceType,
        rating
      }
    });

  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback'
    });
  }
});

module.exports = router;
