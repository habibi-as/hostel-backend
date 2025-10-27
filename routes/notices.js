const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

// Get notices
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { category, priority, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT n.*, u.name as created_by_name
      FROM notices n
      JOIN users u ON n.created_by = u.id
      WHERE n.is_active = TRUE
    `;
    let params = [];

    if (category) {
      query += ' AND n.category = ?';
      params.push(category);
    }

    if (priority) {
      query += ' AND n.priority = ?';
      params.push(priority);
    }

    query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [notices] = await db.promise().execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM notices WHERE is_active = TRUE';
    let countParams = [];

    if (category) {
      countQuery += ' AND category = ?';
      countParams.push(category);
    }

    if (priority) {
      countQuery += ' AND priority = ?';
      countParams.push(priority);
    }

    const [countResult] = await db.promise().execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        notices,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get notices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notices'
    });
  }
});

// Get notice by ID
router.get('/:id', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { id } = req.params;

    const [notices] = await db.promise().execute(`
      SELECT n.*, u.name as created_by_name
      FROM notices n
      JOIN users u ON n.created_by = u.id
      WHERE n.id = ?
    `, [id]);

    if (notices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    res.json({
      success: true,
      data: notices[0]
    });

  } catch (error) {
    console.error('Get notice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notice'
    });
  }
});

// Create notice (Admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('title').notEmpty().withMessage('Title is required'),
  body('content').notEmpty().withMessage('Content is required'),
  body('category').isIn(['general', 'maintenance', 'event', 'emergency', 'academic']).withMessage('Invalid category'),
  body('priority').isIn(['normal', 'important', 'urgent']).withMessage('Invalid priority')
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

    const { title, content, category, priority } = req.body;
    const createdBy = req.user.id;

    // Create notice
    const [result] = await db.promise().execute(
      'INSERT INTO notices (title, content, category, priority, created_by) VALUES (?, ?, ?, ?, ?)',
      [title, content, category, priority, createdBy]
    );

    res.status(201).json({
      success: true,
      message: 'Notice created successfully',
      data: {
        id: result.insertId,
        title,
        category,
        priority
      }
    });

  } catch (error) {
    console.error('Create notice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notice'
    });
  }
});

// Update notice (Admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('title').optional().notEmpty().withMessage('Title cannot be empty'),
  body('content').optional().notEmpty().withMessage('Content cannot be empty'),
  body('category').optional().isIn(['general', 'maintenance', 'event', 'emergency', 'academic']).withMessage('Invalid category'),
  body('priority').optional().isIn(['normal', 'important', 'urgent']).withMessage('Invalid priority')
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
    const { title, content, category, priority, is_active } = req.body;

    // Check if notice exists
    const [notices] = await db.promise().execute(
      'SELECT id FROM notices WHERE id = ?',
      [id]
    );

    if (notices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    let updateFields = [];
    let values = [];

    if (title) {
      updateFields.push('title = ?');
      values.push(title);
    }
    if (content) {
      updateFields.push('content = ?');
      values.push(content);
    }
    if (category) {
      updateFields.push('category = ?');
      values.push(category);
    }
    if (priority) {
      updateFields.push('priority = ?');
      values.push(priority);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      values.push(is_active);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(id);

    await db.promise().execute(
      `UPDATE notices SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Notice updated successfully'
    });

  } catch (error) {
    console.error('Update notice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notice'
    });
  }
});

// Delete notice (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if notice exists
    const [notices] = await db.promise().execute(
      'SELECT id FROM notices WHERE id = ?',
      [id]
    );

    if (notices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    // Delete notice
    await db.promise().execute('DELETE FROM notices WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Notice deleted successfully'
    });

  } catch (error) {
    console.error('Delete notice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notice'
    });
  }
});

// Get recent notices
router.get('/recent/list', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const [notices] = await db.promise().execute(`
      SELECT n.*, u.name as created_by_name
      FROM notices n
      JOIN users u ON n.created_by = u.id
      WHERE n.is_active = TRUE
      ORDER BY n.created_at DESC
      LIMIT ?
    `, [parseInt(limit)]);

    res.json({
      success: true,
      data: notices
    });

  } catch (error) {
    console.error('Get recent notices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent notices'
    });
  }
});

// Get notices by category
router.get('/category/:category', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const [notices] = await db.promise().execute(`
      SELECT n.*, u.name as created_by_name
      FROM notices n
      JOIN users u ON n.created_by = u.id
      WHERE n.category = ? AND n.is_active = TRUE
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `, [category, parseInt(limit), offset]);

    // Get total count
    const [countResult] = await db.promise().execute(
      'SELECT COUNT(*) as total FROM notices WHERE category = ? AND is_active = TRUE',
      [category]
    );
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        notices,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get notices by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notices by category'
    });
  }
});

module.exports = router;
