const express = require('express');
const { body, validationResult } = require('express-validator');
const Feedback = require('../models/Feedback');
const User = require('../models/user');
const { authenticateToken, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

/**
 * @route GET /api/feedback
 * @desc Get all feedback with pagination and optional filtering by service type
 * @access Admin & Student (any role)
 */
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { serviceType, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (serviceType) filter.serviceType = serviceType;

    const feedbacks = await Feedback.find(filter)
      .populate('user', 'name email roomNo')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Feedback.countDocuments(filter);

    res.json({
      success: true,
      data: {
        feedbacks,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch feedback' });
  }
});

/**
 * @route POST /api/feedback
 * @desc Submit feedback for a service
 * @access Student/Admin (any authenticated role)
 */
router.post(
  '/',
  authenticateToken,
  requireAnyRole,
  [
    body('serviceType')
      .isIn(['food', 'cleaning', 'security', 'maintenance', 'overall'])
      .withMessage('Invalid service type'),
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { serviceType, rating, comment } = req.body;

      const feedback = new Feedback({
        user: req.user.id,
        serviceType,
        rating,
        comment,
      });

      await feedback.save();

      res.status(201).json({
        success: true,
        message: 'Feedback submitted successfully',
        data: feedback,
      });
    } catch (error) {
      console.error('Submit feedback error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit feedback',
      });
    }
  }
);

module.exports = router;
