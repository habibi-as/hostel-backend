const express = require('express');
const { body, validationResult } = require('express-validator');
const Event = require('../models/Event');
const User = require('../models/user');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

/**
 * @route GET /api/events
 * @desc Get all active events (filtered & paginated)
 * @access Admin & Student
 */
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { eventType, page = 1, limit = 10 } = req.query;
    const filter = { isActive: true };

    if (eventType) filter.eventType = eventType;

    const events = await Event.find(filter)
      .populate('createdBy', 'name email')
      .sort({ eventDate: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Event.countDocuments(filter);

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
});

/**
 * @route POST /api/events
 * @desc Create new event (Admin only)
 * @access Admin
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('eventDate').isISO8601().withMessage('Valid event date is required'),
    body('eventType')
      .isIn(['academic', 'cultural', 'sports', 'social', 'maintenance'])
      .withMessage('Invalid event type'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { title, description, eventDate, eventTime, location, eventType } = req.body;

      const event = new Event({
        title,
        description,
        eventDate,
        eventTime,
        location,
        eventType,
        createdBy: req.user.id
      });

      await event.save();

      res.status(201).json({
        success: true,
        message: 'Event created successfully',
        data: event
      });
    } catch (error) {
      console.error('Create event error:', error);
      res.status(500).json({ success: false, message: 'Failed to create event' });
    }
  }
);

/**
 * @route DELETE /api/events/:id
 * @desc Soft delete event (Admin only)
 * @access Admin
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    event.isActive = false;
    await event.save();

    res.json({ success: true, message: 'Event deleted (soft delete) successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete event' });
  }
});

export default router;


