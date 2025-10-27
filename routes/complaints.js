const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

// Get complaints
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { status, category, priority, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const currentUser = req.user;

    let query = `
      SELECT c.*, u.name, u.email, u.room_no, u.batch
      FROM complaints c
      JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;
    let params = [];

    // Students can only view their own complaints
    if (currentUser.role === 'student') {
      query += ' AND c.user_id = ?';
      params.push(currentUser.id);
    }

    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }

    if (category) {
      query += ' AND c.category = ?';
      params.push(category);
    }

    if (priority) {
      query += ' AND c.priority = ?';
      params.push(priority);
    }

    query += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [complaints] = await db.promise().execute(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM complaints c
      JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;
    let countParams = [];

    if (currentUser.role === 'student') {
      countQuery += ' AND c.user_id = ?';
      countParams.push(currentUser.id);
    }

    if (status) {
      countQuery += ' AND c.status = ?';
      countParams.push(status);
    }

    if (category) {
      countQuery += ' AND c.category = ?';
      countParams.push(category);
    }

    if (priority) {
      countQuery += ' AND c.priority = ?';
      countParams.push(priority);
    }

    const [countResult] = await db.promise().execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        complaints,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints'
    });
  }
});

// Get complaint by ID
router.get('/:id', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const [complaints] = await db.promise().execute(`
      SELECT c.*, u.name, u.email, u.room_no, u.batch, u.phone
      FROM complaints c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [id]);

    if (complaints.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    const complaint = complaints[0];

    // Students can only view their own complaints
    if (currentUser.role === 'student' && complaint.user_id !== currentUser.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: complaint
    });

  } catch (error) {
    console.error('Get complaint error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint'
    });
  }
});

// Create complaint
router.post('/', authenticateToken, requireAnyRole, [
  body('category').isIn(['food', 'maintenance', 'electricity', 'cleanliness', 'security', 'other']).withMessage('Invalid category'),
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority')
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

    const { category, title, description, priority = 'medium' } = req.body;
    const userId = req.user.id;

    // Create complaint
    const [result] = await db.promise().execute(
      'INSERT INTO complaints (user_id, category, title, description, priority) VALUES (?, ?, ?, ?, ?)',
      [userId, category, title, description, priority]
    );

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      data: {
        id: result.insertId,
        category,
        title,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Create complaint error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit complaint'
    });
  }
});

// Update complaint status (Admin only)
router.put('/:id/status', authenticateToken, requireAdmin, [
  body('status').isIn(['pending', 'in_progress', 'resolved', 'rejected']).withMessage('Invalid status'),
  body('adminResponse').optional().isString().withMessage('Admin response must be a string')
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
    const { status, adminResponse } = req.body;

    // Check if complaint exists
    const [complaints] = await db.promise().execute(
      'SELECT * FROM complaints WHERE id = ?',
      [id]
    );

    if (complaints.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Update complaint
    await db.promise().execute(
      'UPDATE complaints SET status = ?, admin_response = ? WHERE id = ?',
      [status, adminResponse, id]
    );

    res.json({
      success: true,
      message: 'Complaint status updated successfully'
    });

  } catch (error) {
    console.error('Update complaint status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update complaint status'
    });
  }
});

// Get complaint statistics (Admin only)
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT 
        COUNT(*) as total_complaints,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_complaints,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_complaints,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_complaints,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_complaints
      FROM complaints
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

    // Get complaints by category
    const [categoryStats] = await db.promise().execute(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
      FROM complaints
      WHERE 1=1
        ${startDate ? 'AND DATE(created_at) >= ?' : ''}
        ${endDate ? 'AND DATE(created_at) <= ?' : ''}
      GROUP BY category
      ORDER BY count DESC
    `, startDate && endDate ? [startDate, endDate] : []);

    // Get complaints by priority
    const [priorityStats] = await db.promise().execute(`
      SELECT 
        priority,
        COUNT(*) as count
      FROM complaints
      WHERE 1=1
        ${startDate ? 'AND DATE(created_at) >= ?' : ''}
        ${endDate ? 'AND DATE(created_at) <= ?' : ''}
      GROUP BY priority
      ORDER BY 
        CASE priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END
    `, startDate && endDate ? [startDate, endDate] : []);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        byCategory: categoryStats,
        byPriority: priorityStats
      }
    });

  } catch (error) {
    console.error('Get complaint stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint statistics'
    });
  }
});

// Get recent complaints (Admin only)
router.get('/recent/list', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const [complaints] = await db.promise().execute(`
      SELECT c.*, u.name, u.email, u.room_no, u.batch
      FROM complaints c
      JOIN users u ON c.user_id = u.id
      ORDER BY c.created_at DESC
      LIMIT ?
    `, [parseInt(limit)]);

    res.json({
      success: true,
      data: complaints
    });

  } catch (error) {
    console.error('Get recent complaints error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent complaints'
    });
  }
});

// Get complaints by user (Admin only)
router.get('/user/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT c.*, u.name, u.email, u.room_no, u.batch
      FROM complaints c
      JOIN users u ON c.user_id = u.id
      WHERE c.user_id = ?
    `;
    let params = [userId];

    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }

    query += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [complaints] = await db.promise().execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM complaints WHERE user_id = ?';
    let countParams = [userId];

    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    const [countResult] = await db.promise().execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        complaints,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get user complaints error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user complaints'
    });
  }
});

// Delete complaint (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if complaint exists
    const [complaints] = await db.promise().execute(
      'SELECT id FROM complaints WHERE id = ?',
      [id]
    );

    if (complaints.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Delete complaint
    await db.promise().execute('DELETE FROM complaints WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Complaint deleted successfully'
    });

  } catch (error) {
    console.error('Delete complaint error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete complaint'
    });
  }
});

module.exports = router;
