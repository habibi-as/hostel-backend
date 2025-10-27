const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Get lost and found items
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { status, category, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT lf.*, u.name as reported_by_name, u.email, u.phone
      FROM lost_found lf
      JOIN users u ON lf.user_id = u.id
      WHERE 1=1
    `;
    let params = [];

    if (status) {
      query += ' AND lf.status = ?';
      params.push(status);
    }

    if (category) {
      query += ' AND lf.category = ?';
      params.push(category);
    }

    query += ' ORDER BY lf.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [items] = await db.promise().execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM lost_found WHERE 1=1';
    let countParams = [];

    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    if (category) {
      countQuery += ' AND category = ?';
      countParams.push(category);
    }

    const [countResult] = await db.promise().execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get lost and found items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lost and found items'
    });
  }
});

// Get item by ID
router.get('/:id', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { id } = req.params;

    const [items] = await db.promise().execute(`
      SELECT lf.*, u.name as reported_by_name, u.email, u.phone
      FROM lost_found lf
      JOIN users u ON lf.user_id = u.id
      WHERE lf.id = ?
    `, [id]);

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.json({
      success: true,
      data: items[0]
    });

  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch item'
    });
  }
});

// Report lost item
router.post('/report', authenticateToken, requireAnyRole, upload.single('image'), [
  body('itemName').notEmpty().withMessage('Item name is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('category').isIn(['electronics', 'clothing', 'books', 'accessories', 'other']).withMessage('Invalid category'),
  body('locationFound').optional().isString().withMessage('Location must be a string')
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

    const { itemName, description, category, locationFound } = req.body;
    const userId = req.user.id;
    const image = req.file ? req.file.filename : null;

    // Create lost item report
    const [result] = await db.promise().execute(
      'INSERT INTO lost_found (user_id, item_name, description, category, location_found, image) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, itemName, description, category, locationFound, image]
    );

    res.status(201).json({
      success: true,
      message: 'Lost item reported successfully',
      data: {
        id: result.insertId,
        itemName,
        category,
        status: 'reported'
      }
    });

  } catch (error) {
    console.error('Report lost item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to report lost item'
    });
  }
});

// Update item status (Admin only)
router.put('/:id/status', authenticateToken, requireAdmin, [
  body('status').isIn(['reported', 'claimed', 'unclaimed']).withMessage('Invalid status'),
  body('claimedBy').optional().isInt().withMessage('Valid claimed by user ID is required')
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
    const { status, claimedBy } = req.body;

    // Check if item exists
    const [items] = await db.promise().execute(
      'SELECT * FROM lost_found WHERE id = ?',
      [id]
    );

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    let updateFields = ['status = ?'];
    let values = [status];

    if (status === 'claimed' && claimedBy) {
      updateFields.push('claimed_by = ?', 'claimed_at = NOW()');
      values.push(claimedBy);
    }

    values.push(id);

    await db.promise().execute(
      `UPDATE lost_found SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Item status updated successfully'
    });

  } catch (error) {
    console.error('Update item status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update item status'
    });
  }
});

// Get user's reported items
router.get('/user/:userId', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;

    // Students can only view their own items
    if (currentUser.role === 'student' && parseInt(userId) !== currentUser.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT lf.*, u.name as reported_by_name
      FROM lost_found lf
      JOIN users u ON lf.user_id = u.id
      WHERE lf.user_id = ?
    `;
    let params = [userId];

    if (status) {
      query += ' AND lf.status = ?';
      params.push(status);
    }

    query += ' ORDER BY lf.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [items] = await db.promise().execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM lost_found WHERE user_id = ?';
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
        items,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get user items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user items'
    });
  }
});

// Search items
router.get('/search/items', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { q, category, status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT lf.*, u.name as reported_by_name
      FROM lost_found lf
      JOIN users u ON lf.user_id = u.id
      WHERE 1=1
    `;
    let params = [];

    if (q) {
      query += ' AND (lf.item_name LIKE ? OR lf.description LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }

    if (category) {
      query += ' AND lf.category = ?';
      params.push(category);
    }

    if (status) {
      query += ' AND lf.status = ?';
      params.push(status);
    }

    query += ' ORDER BY lf.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [items] = await db.promise().execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM lost_found WHERE 1=1';
    let countParams = [];

    if (q) {
      countQuery += ' AND (item_name LIKE ? OR description LIKE ?)';
      countParams.push(`%${q}%`, `%${q}%`);
    }

    if (category) {
      countQuery += ' AND category = ?';
      countParams.push(category);
    }

    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    const [countResult] = await db.promise().execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Search items error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search items'
    });
  }
});

// Get lost and found statistics (Admin only)
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT 
        COUNT(*) as total_items,
        SUM(CASE WHEN status = 'reported' THEN 1 ELSE 0 END) as reported_items,
        SUM(CASE WHEN status = 'claimed' THEN 1 ELSE 0 END) as claimed_items,
        SUM(CASE WHEN status = 'unclaimed' THEN 1 ELSE 0 END) as unclaimed_items
      FROM lost_found
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

    // Get items by category
    const [categoryStats] = await db.promise().execute(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'claimed' THEN 1 ELSE 0 END) as claimed
      FROM lost_found
      WHERE 1=1
        ${startDate ? 'AND DATE(created_at) >= ?' : ''}
        ${endDate ? 'AND DATE(created_at) <= ?' : ''}
      GROUP BY category
      ORDER BY count DESC
    `, startDate && endDate ? [startDate, endDate] : []);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        byCategory: categoryStats
      }
    });

  } catch (error) {
    console.error('Get lost and found stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lost and found statistics'
    });
  }
});

// Delete item (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if item exists
    const [items] = await db.promise().execute(
      'SELECT id FROM lost_found WHERE id = ?',
      [id]
    );

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    // Delete item
    await db.promise().execute('DELETE FROM lost_found WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Item deleted successfully'
    });

  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete item'
    });
  }
});

module.exports = router;
