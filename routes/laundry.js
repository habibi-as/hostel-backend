const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');
const LaundryRequest = require('../models/LaundryRequest');

const router = express.Router();

// GET all laundry requests
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const currentUser = req.user;

    const filter = {};
    if (status) filter.status = status;

    // Students can only view their own requests
    if (currentUser.role === 'student') {
      filter.user = currentUser.id;
    }

    const requests = await LaundryRequest.find(filter)
      .populate('user', 'name email roomNo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await LaundryRequest.countDocuments(filter);

    res.json({
      success: true,
      data: requests,
      pagination: {
        current: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error('Get laundry requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch laundry requests',
    });
  }
});

// POST new laundry request
router.post(
  '/',
  authenticateToken,
  requireAnyRole,
  [
    body('requestType')
      .isIn(['wash', 'iron', 'dry_clean'])
      .withMessage('Invalid request type'),
    body('itemsCount')
      .isInt({ min: 1 })
      .withMessage('Items count must be at least 1'),
    body('pickupDate').isISO8601().withMessage('Valid pickup date is required'),
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

      const { requestType, itemsCount, pickupDate } = req.body;
      const userId = req.user.id;

      const newRequest = new LaundryRequest({
        user: userId,
        requestType,
        itemsCount,
        pickupDate,
      });

      await newRequest.save();

      res.status(201).json({
        success: true,
        message: 'Laundry request submitted successfully',
        data: newRequest,
      });
    } catch (error) {
      console.error('Create laundry request error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit laundry request',
      });
    }
  }
);

// PUT update laundry request status (Admin only)
router.put(
  '/:id/status',
  authenticateToken,
  requireAdmin,
  [
    body('status')
      .isIn(['pending', 'picked_up', 'processing', 'ready', 'delivered'])
      .withMessage('Invalid status'),
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

      const { id } = req.params;
      const { status, totalAmount, deliveryDate } = req.body;

      const updateData = { status };
      if (totalAmount !== undefined) updateData.totalAmount = totalAmount;
      if (deliveryDate && status === 'delivered') updateData.deliveryDate = deliveryDate;

      const updatedRequest = await LaundryRequest.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      );

      if (!updatedRequest) {
        return res.status(404).json({
          success: false,
          message: 'Laundry request not found',
        });
      }

      res.json({
        success: true,
        message: 'Laundry request status updated successfully',
        data: updatedRequest,
      });
    } catch (error) {
      console.error('Update laundry request error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update laundry request',
      });
    }
  }
);

export default router;

