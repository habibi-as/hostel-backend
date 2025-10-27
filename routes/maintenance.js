const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

// Get maintenance requests
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { status, issueType, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const currentUser = req.user;

    let query = `
      SELECT mr.*, u.name, u.email, u.room_no
      FROM maintenance_requests mr
      JOIN users u ON mr.user_id = u.id
      WHERE 1=1
    `;
    let params = [];

    // Students can only view their own requests
    if (currentUser.role === 'student') {
      query += ' AND mr.user_id = ?';
      params.push(currentUser.id);
    }

    if (status) {
      query += ' AND mr.status = ?';
      params.push(status);
    }

    if (issueType) {
      query += ' AND mr.issue_type = ?';
      params.push(issueType);
    }

    query += ' ORDER BY mr.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [requests] = await db.promise().execute(query, params);

    res.json({
      success: true,
      data: requests
    });

  } catch (error) {
    console.error('Get maintenance requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch maintenance requests'
    });
  }
});

// Create maintenance request
router.post('/', authenticateToken, requireAnyRole, [
  body('issueType').isIn(['plumbing', 'electrical', 'furniture', 'cleaning', 'other']).withMessage('Invalid issue type'),
  body('description').notEmpty().withMessage('Description is required'),
  body('priority').isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority')
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

    const { issueType, description, priority, roomNo } = req.body;
    const userId = req.user.id;

    const [result] = await db.promise().execute(
      'INSERT INTO maintenance_requests (user_id, room_no, issue_type, description, priority) VALUES (?, ?, ?, ?, ?)',
      [userId, roomNo, issueType, description, priority]
    );

    res.status(201).json({
      success: true,
      message: 'Maintenance request submitted successfully',
      data: {
        id: result.insertId,
        issueType,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Create maintenance request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit maintenance request'
    });
  }
});

// Update maintenance request (Admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('status').isIn(['pending', 'assigned', 'in_progress', 'completed', 'cancelled']).withMessage('Invalid status')
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
    const { status, assignedTo } = req.body;

    let updateFields = ['status = ?'];
    let values = [status];

    if (assignedTo) {
      updateFields.push('assigned_to = ?');
      values.push(assignedTo);
    }

    if (status === 'completed') {
      updateFields.push('completed_at = NOW()');
    }

    values.push(id);

    await db.promise().execute(
      `UPDATE maintenance_requests SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Maintenance request updated successfully'
    });

  } catch (error) {
    console.error('Update maintenance request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update maintenance request'
    });
  }
});

module.exports = router;
