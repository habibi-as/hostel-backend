const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

// Get events
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { eventType, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT e.*, u.name as created_by_name
      FROM events e
      JOIN users u ON e.created_by = u.id
      WHERE e.is_active = TRUE
    `;
    let params = [];

    if (eventType) {
      query += ' AND e.event_type = ?';
      params.push(eventType);
    }

    query += ' ORDER BY e.event_date ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [events] = await db.promise().execute(query, params);

    res.json({
      success: true,
      data: events
    });

  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events'
    });
  }
});

// Create event (Admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('title').notEmpty().withMessage('Title is required'),
  body('eventDate').isISO8601().withMessage('Valid event date is required'),
  body('eventType').isIn(['academic', 'cultural', 'sports', 'social', 'maintenance']).withMessage('Invalid event type')
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

    const { title, description, eventDate, eventTime, location, eventType } = req.body;
    const createdBy = req.user.id;

    const [result] = await db.promise().execute(
      'INSERT INTO events (title, description, event_date, event_time, location, event_type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, description, eventDate, eventTime, location, eventType, createdBy]
    );

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: {
        id: result.insertId,
        title,
        eventDate
      }
    });

  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create event'
    });
  }
});

module.exports = router;
