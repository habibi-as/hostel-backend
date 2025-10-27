const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

// Get visitors
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const currentUser = req.user;

    let query = `
      SELECT v.*, u.name as student_name, u.room_no
      FROM visitors v
      JOIN users u ON v.student_id = u.id
      WHERE 1=1
    `;
    let params = [];

    // Students can only view their own visitors
    if (currentUser.role === 'student') {
      query += ' AND v.student_id = ?';
      params.push(currentUser.id);
    }

    if (status) {
      query += ' AND v.status = ?';
      params.push(status);
    }

    query += ' ORDER BY v.entry_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [visitors] = await db.promise().execute(query, params);

    res.json({
      success: true,
      data: visitors
    });

  } catch (error) {
    console.error('Get visitors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch visitors'
    });
  }
});

// Register visitor
router.post('/', authenticateToken, requireAnyRole, [
  body('visitorName').notEmpty().withMessage('Visitor name is required'),
  body('visitorPhone').notEmpty().withMessage('Visitor phone is required'),
  body('visitorIdType').isIn(['aadhar', 'pan', 'driving_license', 'passport']).withMessage('Invalid ID type'),
  body('visitorIdNumber').notEmpty().withMessage('Visitor ID number is required'),
  body('purpose').notEmpty().withMessage('Purpose is required')
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

    const { visitorName, visitorPhone, visitorIdType, visitorIdNumber, purpose } = req.body;
    const studentId = req.user.id;

    const [result] = await db.promise().execute(
      'INSERT INTO visitors (student_id, visitor_name, visitor_phone, visitor_id_type, visitor_id_number, purpose) VALUES (?, ?, ?, ?, ?, ?)',
      [studentId, visitorName, visitorPhone, visitorIdType, visitorIdNumber, purpose]
    );

    res.status(201).json({
      success: true,
      message: 'Visitor registered successfully',
      data: {
        id: result.insertId,
        visitorName,
        status: 'inside'
      }
    });

  } catch (error) {
    console.error('Register visitor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register visitor'
    });
  }
});

// Update visitor status (Admin only)
router.put('/:id/status', authenticateToken, requireAdmin, [
  body('status').isIn(['inside', 'left']).withMessage('Invalid status')
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
    const { status } = req.body;

    let updateFields = ['status = ?'];
    let values = [status];

    if (status === 'left') {
      updateFields.push('exit_time = NOW()');
    }

    values.push(id);

    await db.promise().execute(
      `UPDATE visitors SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Visitor status updated successfully'
    });

  } catch (error) {
    console.error('Update visitor status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update visitor status'
    });
  }
});

module.exports = router;
