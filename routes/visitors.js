const express = require('express');
const Visitor = require('../models/Visitor');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

/**
 * 🧾 GET all visitors (Admin + Warden)
 */
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const visitors = await Visitor.find()
      .populate('student', 'name email')
      .sort({ checkInTime: -1 });

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

/**
 * ➕ Add new visitor (Admin/Warden)
 */
router.post('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { name, contact, purpose, student, remarks } = req.body;

    const visitor = new Visitor({
      name,
      contact,
      purpose,
      student,
      remarks
    });

    await visitor.save();

    res.json({
      success: true,
      message: 'Visitor added successfully',
      data: visitor
    });
  } catch (error) {
    console.error('Add visitor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add visitor'
    });
  }
});

/**
 * 🔁 Check-out visitor (Admin/Warden)
 */
router.put('/:id/checkout', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);
    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: 'Visitor not found'
      });
    }

    visitor.checkOutTime = new Date();
    visitor.status = 'checked_out';
    await visitor.save();

    res.json({
      success: true,
      message: 'Visitor checked out successfully',
      data: visitor
    });
  } catch (error) {
    console.error('Check-out visitor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update visitor'
    });
  }
});

/**
 * 🗑️ Delete visitor (Admin only)
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);
    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: 'Visitor not found'
      });
    }

    await Visitor.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Visitor record deleted successfully'
    });
  } catch (error) {
    console.error('Delete visitor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete visitor'
    });
  }
});

module.exports = router;
