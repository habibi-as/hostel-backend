const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

// Get laundry requests
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const currentUser = req.user;

    let query = `
      SELECT lr.*, u.name, u.email, u.room_no
      FROM laundry_requests lr
      JOIN users u ON lr.user_id = u.id
      WHERE 1=1
    `;
    let params = [];

    // Students can only view their own requests
    if (currentUser.role === 'student') {
      query += ' AND lr.user_id = ?';
      params.push(currentUser.id);
    }

    if (status) {
      query += ' AND lr.status = ?';
      params.push(status);
    }

    query += ' ORDER BY lr.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [requests] = await db.promise().execute(query, params);

    res.json({
      success: true,
      data: requests
    });

  } catch (error) {
    console.error('Get laundry requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch laundry requests'
    });
  }
});

// Create laundry request
router.post('/', authenticateToken, requireAnyRole, [
  body('requestType').isIn(['wash', 'iron', 'dry_clean']).withMessage('Invalid request type'),
  body('itemsCount').isInt({ min: 1 }).withMessage('Items count must be at least 1'),
  body('pickupDate').isISO8601().withMessage('Valid pickup date is required')
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

    const { requestType, itemsCount, pickupDate } = req.body;
    const userId = req.user.id;

    const [result] = await db.promise().execute(
      'INSERT INTO laundry_requests (user_id, request_type, items_count, pickup_date) VALUES (?, ?, ?, ?)',
      [userId, requestType, itemsCount, pickupDate]
    );

    res.status(201).json({
      success: true,
      message: 'Laundry request submitted successfully',
      data: {
        id: result.insertId,
        requestType,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Create laundry request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit laundry request'
    });
  }
});

// Update laundry request status (Admin only)
router.put('/:id/status', authenticateToken, requireAdmin, [
  body('status').isIn(['pending', 'picked_up', 'processing', 'ready', 'delivered']).withMessage('Invalid status')
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

    const { id } = req.params;
    const { status, totalAmount, deliveryDate } = req.body;

    let updateFields = ['status = ?'];
    let values = [status];

    if (totalAmount) {
      updateFields.push('total_amount = ?');
      values.push(totalAmount);
    }

    if (status === 'delivered' && deliveryDate) {
      updateFields.push('delivery_date = ?');
      values.push(deliveryDate);
    }

    values.push(id);

    await db.promise().execute(
      `UPDATE laundry_requests SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Laundry request status updated successfully'
    });

  } catch (error) {
    console.error('Update laundry request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update laundry request'
    });
  }
});

module.exports = router;
