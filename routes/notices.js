const express = require('express');
const { body, validationResult } = require('express-validator');
const Notice = require('../models/Notice');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

// 🟢 Get notices (with filters + pagination)
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { category, priority, page = 1, limit = 10 } = req.query;
    const query = { isActive: true };

    if (category) query.category = category;
    if (priority) query.priority = priority;

    const total = await Notice.countDocuments(query);
    const notices = await Notice.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

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

// 🟢 Get single notice by ID
router.get('/:id', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id).populate('createdBy', 'name email');

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    res.json({
      success: true,
      data: notice
    });

  } catch (error) {
    console.error('Get notice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notice'
    });
  }
});

// 🟢 Create notice (Admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('title').notEmpty(),
  body('content').notEmpty(),
  body('category').isIn(['general', 'maintenance', 'event', 'emergency', 'academic']),
  body('priority').isIn(['normal', 'important', 'urgent'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, content, category, priority } = req.body;
    const createdBy = req.user.id;

    const notice = await Notice.create({ title, content, category, priority, createdBy });

    res.status(201).json({
      success: true,
      message: 'Notice created successfully',
      data: notice
    });

  } catch (error) {
    console.error('Create notice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notice'
    });
  }
});

// 🟢 Update notice (Admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('title').optional().notEmpty(),
  body('content').optional().notEmpty(),
  body('category').optional().isIn(['general', 'maintenance', 'event', 'emergency', 'academic']),
  body('priority').optional().isIn(['normal', 'important', 'urgent'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const updateData = req.body;
    const updated = await Notice.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    res.json({
      success: true,
      message: 'Notice updated successfully',
      data: updated
    });

  } catch (error) {
    console.error('Update notice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notice'
    });
  }
});

// 🟢 Delete notice (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const deleted = await Notice.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

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

// 🟢 Recent notices (limit)
router.get('/recent/list', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const notices = await Notice.find({ isActive: true })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

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

// 🟢 Get notices by category
router.get('/category/:category', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const query = { category, isActive: true };
    const total = await Notice.countDocuments(query);

    const notices = await Notice.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

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

export default router;

