// routes/maintenanceRoutes.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

// 🟢 Get Maintenance Requests
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { status, issueType, page = 1, limit = 10 } = req.query;
    const currentUser = req.user;
    const query = {};

    if (currentUser.role === 'student') {
      query.user = currentUser.id;
    }

    if (status) query.status = status;
    if (issueType) query.issueType = issueType;

    const requests = await MaintenanceRequest.find(query)
      .populate('user', 'name email roomNo')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('Get maintenance requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch maintenance requests' });
  }
});

// 🟢 Create Maintenance Request
router.post(
  '/',
  authenticateToken,
  requireAnyRole,
  [
    body('issueType').isIn(['plumbing', 'electrical', 'furniture', 'cleaning', 'other']),
    body('description').notEmpty(),
    body('priority').isIn(['low', 'medium', 'high', 'urgent']),
    body('roomNo').notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { issueType, description, priority, roomNo } = req.body;

      const newRequest = new MaintenanceRequest({
        user: req.user.id,
        roomNo,
        issueType,
        description,
        priority,
      });

      const saved = await newRequest.save();

      res.status(201).json({
        success: true,
        message: 'Maintenance request submitted successfully',
        data: saved,
      });
    } catch (error) {
      console.error('Create maintenance request error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit maintenance request',
      });
    }
  }
);

// 🟢 Update Maintenance Request (Admin only)
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  [body('status').isIn(['pending', 'assigned', 'in_progress', 'completed', 'cancelled'])],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { status, assignedTo } = req.body;
      const updateData = { status };

      if (assignedTo) updateData.assignedTo = assignedTo;
      if (status === 'completed') updateData.completedAt = new Date();

      await MaintenanceRequest.findByIdAndUpdate(req.params.id, updateData);

      res.json({
        success: true,
        message: 'Maintenance request updated successfully',
      });
    } catch (error) {
      console.error('Update maintenance request error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update maintenance request',
      });
    }
  }
);

export default router;

