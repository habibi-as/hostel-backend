const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const LostFound = require('../models/LostFound');

const router = express.Router();

// 🟩 Get all lost & found items
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { status, category, page = 1, limit = 10 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;

    const items = await LostFound.find(query)
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await LostFound.countDocuments(query);

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
    res.status(500).json({ success: false, message: 'Failed to fetch lost and found items' });
  }
});

// 🟨 Get single item by ID
router.get('/:id', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const item = await LostFound.findById(req.params.id).populate('user', 'name email phone');
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch item' });
  }
});

// 🟧 Report new lost item
router.post('/report', authenticateToken, requireAnyRole, upload.single('image'), [
  body('itemName').notEmpty(),
  body('description').notEmpty(),
  body('category').isIn(['electronics', 'clothing', 'books', 'accessories', 'other'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { itemName, description, category, locationFound } = req.body;
    const image = req.file ? req.file.filename : null;

    const item = new LostFound({
      user: req.user.id,
      itemName,
      description,
      category,
      locationFound,
      image
    });

    await item.save();
    res.status(201).json({ success: true, message: 'Lost item reported successfully', data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to report lost item' });
  }
});

// 🟦 Update item status (Admin only)
router.put('/:id/status', authenticateToken, requireAdmin, [
  body('status').isIn(['reported', 'claimed', 'unclaimed'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { status, claimedBy } = req.body;
    const item = await LostFound.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    item.status = status;
    if (status === 'claimed' && claimedBy) {
      item.claimedBy = claimedBy;
      item.claimedAt = new Date();
    }
    await item.save();

    res.json({ success: true, message: 'Item status updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update item status' });
  }
});

// 🟪 Delete item (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const item = await LostFound.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    await item.deleteOne();
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete item' });
  }
});

export default router;

