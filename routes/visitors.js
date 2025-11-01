const express = require('express');
const { body, validationResult } = require('express-validator');
const Visitor = require('../models/Visitor');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

// GET visitors
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const currentUser = req.user;

    let filter = {};
    if (status) filter.status = status;
    if (currentUser.role === 'student') filter.student = currentUser.id;

    const visitors = await Visitor.find(filter)
      .populate('student', 'name room_no')
      .sort({ entryTime: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: visitors
    });
  } catch (error) {
    console.error('Get visitors error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch visitors' });
  }
});

// Register visitor
router.post(
  '/',
  authenticateToken,
  requireAnyRole,
  [
    body('visitorName').notEmpty(),
    body('visitorPhone').notEmpty(),
    body('visitorIdType').isIn(['aadhar', 'pan', 'driving_license', 'passport']),
    body('visitorIdNumber').notEmpty(),
    body('purpose').notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { visitorName, visitorPhone, visitorIdType, visitorIdNumber, purpose } = req.body;

      const visitor = await Visitor.create({
        student: req.user.id,
        visitorName,
        visitorPhone,
        visitorIdType,
        visitorIdNumber,
        purpose
      });

      res.status(201).json({
        success: true,
        message: 'Visitor registered successfully',
        data: visitor
      });
    } catch (error) {
      console.error('Register visitor error:', error);
      res.status(500).json({ success: false, message: 'Failed to register visitor' });
    }
  }
);

// Update visitor status
router.put('/:id/status', authenticateToken, requireAdmin, [
  body('status').isIn(['inside', 'left'])
], async (req, res) => {
  try {
    const { status } = req.body;
    const updateData = { status };
    if (status === 'left') updateData.exitTime = new Date();

    await Visitor.findByIdAndUpdate(req.params.id, updateData);

    res.json({ success: true, message: 'Visitor status updated successfully' });
  } catch (error) {
    console.error('Update visitor status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update visitor status' });
  }
});

module.exports = router;
