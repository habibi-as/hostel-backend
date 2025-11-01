const express = require('express');
const { body, validationResult } = require('express-validator');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

/**
 * @route GET /complaints
 * @desc Get all complaints (filtered + paginated)
 * @access Admin & Student (students only see their own)
 */
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { status, category, priority, page = 1, limit = 10 } = req.query;
    const filters = {};
    const currentUser = req.user;

    // Students can only view their own
    if (currentUser.role === 'student') filters.user = currentUser.id;
    if (status) filters.status = status;
    if (category) filters.category = category;
    if (priority) filters.priority = priority;

    const complaints = await Complaint.find(filters)
      .populate('user', 'name email room_no batch')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Complaint.countDocuments(filters);

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
    res.status(500).json({ success: false, message: 'Failed to fetch complaints' });
  }
});

/**
 * @route GET /complaints/:id
 * @desc Get single complaint
 * @access Admin & Student (students only view own)
 */
router.get('/:id', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('user', 'name email room_no batch phone');

    if (!complaint)
      return res.status(404).json({ success: false, message: 'Complaint not found' });

    if (req.user.role === 'student' && complaint.user._id.toString() !== req.user.id)
      return res.status(403).json({ success: false, message: 'Access denied' });

    res.json({ success: true, data: complaint });
  } catch (error) {
    console.error('Get complaint error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch complaint' });
  }
});

/**
 * @route POST /complaints
 * @desc Create a new complaint
 * @access Student & Admin
 */
router.post(
  '/',
  authenticateToken,
  requireAnyRole,
  [
    body('category').isIn(['food', 'maintenance', 'electricity', 'cleanliness', 'security', 'other']).withMessage('Invalid category'),
    body('title').notEmpty().withMessage('Title is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { category, title, description, priority = 'medium' } = req.body;
      const complaint = new Complaint({
        user: req.user.id,
        category,
        title,
        description,
        priority
      });
      await complaint.save();

      res.status(201).json({
        success: true,
        message: 'Complaint submitted successfully',
        data: complaint
      });
    } catch (error) {
      console.error('Create complaint error:', error);
      res.status(500).json({ success: false, message: 'Failed to submit complaint' });
    }
  }
);

/**
 * @route PUT /complaints/:id/status
 * @desc Update complaint status (Admin only)
 */
router.put(
  '/:id/status',
  authenticateToken,
  requireAdmin,
  [
    body('status').isIn(['pending', 'in_progress', 'resolved', 'rejected']).withMessage('Invalid status'),
    body('adminResponse').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { id } = req.params;
      const { status, adminResponse } = req.body;

      const complaint = await Complaint.findById(id);
      if (!complaint)
        return res.status(404).json({ success: false, message: 'Complaint not found' });

      complaint.status = status;
      if (adminResponse) complaint.adminResponse = adminResponse;
      await complaint.save();

      res.json({ success: true, message: 'Complaint status updated successfully' });
    } catch (error) {
      console.error('Update complaint status error:', error);
      res.status(500).json({ success: false, message: 'Failed to update status' });
    }
  }
);

/**
 * @route GET /complaints/stats/overview
 * @desc Get complaint stats (Admin only)
 */
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate || endDate) dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);

    const total = await Complaint.countDocuments(dateFilter);
    const statuses = await Complaint.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const categories = await Complaint.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const priorities = await Complaint.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $sort: { count: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: { total },
        byStatus: statuses,
        byCategory: categories,
        byPriority: priorities
      }
    });
  } catch (error) {
    console.error('Get complaint stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch complaint statistics' });
  }
});

/**
 * @route GET /complaints/recent/list
 * @desc Get recent complaints (Admin only)
 */
router.get('/recent/list', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const complaints = await Complaint.find()
      .populate('user', 'name email room_no batch')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, data: complaints });
  } catch (error) {
    console.error('Get recent complaints error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recent complaints' });
  }
});

/**
 * @route DELETE /complaints/:id
 * @desc Delete a complaint (Admin only)
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint)
      return res.status(404).json({ success: false, message: 'Complaint not found' });

    await complaint.deleteOne();
    res.json({ success: true, message: 'Complaint deleted successfully' });
  } catch (error) {
    console.error('Delete complaint error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete complaint' });
  }
});

module.exports = router;
