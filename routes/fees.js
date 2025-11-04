const express = require('express');
const PDFDocument = require('pdfkit');
const { body, validationResult } = require('express-validator');
const Fee = require('../models/Fee');
const User = require('../models/user');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

/**
 * @route GET /api/fees/user/:userId
 * @desc Get fees for a specific user (self or admin)
 */
router.get('/user/:userId', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    const currentUser = req.user;

    if (currentUser.role === 'student' && userId !== currentUser.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const query = { user: userId };
    if (status) query.status = status;

    const fees = await Fee.find(query)
      .populate('user', 'name email batch roomNo')
      .sort({ dueDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Fee.countDocuments(query);

    res.json({
      success: true,
      data: { fees, pagination: { current: parseInt(page), pages: Math.ceil(total / limit), total } },
    });
  } catch (error) {
    console.error('Get user fees error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fees' });
  }
});

/**
 * @route GET /api/fees
 * @desc Get all fees (Admin only)
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, batch, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const students = batch ? await User.find({ batch, role: 'student' }).select('_id') : [];
    if (batch && students.length > 0) filter.user = { $in: students.map((s) => s._id) };

    const fees = await Fee.find(filter)
      .populate('user', 'name email batch roomNo')
      .sort({ dueDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Fee.countDocuments(filter);

    res.json({
      success: true,
      data: { fees, pagination: { current: parseInt(page), pages: Math.ceil(total / limit), total } },
    });
  } catch (error) {
    console.error('Get all fees error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch all fees' });
  }
});

/**
 * @route POST /api/fees
 * @desc Create fee (Admin only)
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('amount').isNumeric().withMessage('Valid amount required'),
    body('feeType').isIn(['monthly', 'semester', 'annual', 'late_fee']).withMessage('Invalid fee type'),
    body('dueDate').isISO8601().withMessage('Valid due date required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { userId, amount, feeType, dueDate, description } = req.body;
      const user = await User.findById(userId);

      if (!user || user.role !== 'student')
        return res.status(404).json({ success: false, message: 'Student not found' });

      const fee = new Fee({ user: userId, amount, feeType, dueDate, description });
      await fee.save();

      res.status(201).json({ success: true, message: 'Fee created successfully', data: fee });
    } catch (error) {
      console.error('Create fee error:', error);
      res.status(500).json({ success: false, message: 'Failed to create fee' });
    }
  }
);

/**
 * @route PUT /api/fees/:id/pay
 * @desc Mark fee as paid (Admin only)
 */
router.put('/:id/pay', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { paidDate, receiptNo } = req.body;

    const fee = await Fee.findById(id);
    if (!fee) return res.status(404).json({ success: false, message: 'Fee not found' });
    if (fee.status === 'paid')
      return res.status(400).json({ success: false, message: 'Fee already paid' });

    fee.status = 'paid';
    fee.paidDate = paidDate || new Date();
    fee.receiptNo = receiptNo || `REC-${fee._id.toString().slice(-6)}`;
    await fee.save();

    res.json({ success: true, message: 'Fee marked as paid' });
  } catch (error) {
    console.error('Mark fee paid error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark fee as paid' });
  }
});

/**
 * @route GET /api/fees/:id/receipt
 * @desc Generate PDF receipt
 */
router.get('/:id/receipt', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const fee = await Fee.findById(id).populate('user', 'name email batch roomNo phone');
    if (!fee) return res.status(404).json({ success: false, message: 'Fee not found' });

    if (currentUser.role === 'student' && fee.user._id.toString() !== currentUser.id)
      return res.status(403).json({ success: false, message: 'Access denied' });

    if (fee.status !== 'paid')
      return res.status(400).json({ success: false, message: 'Fee not paid yet' });

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${fee.receiptNo || fee.id}.pdf`);
    doc.pipe(res);

    doc.fontSize(20).text('HOSTEL FEE RECEIPT', { align: 'center' });
    doc.fontSize(12).text('Hostel Management System', { align: 'center' });
    doc.moveDown();

    doc.fontSize(14).text('Receipt Details:', { underline: true });
    doc.moveDown(0.5);

    doc.text(`Receipt No: ${fee.receiptNo}`);
    doc.text(`Date: ${fee.paidDate.toDateString()}`);
    doc.text(`Student Name: ${fee.user.name}`);
    doc.text(`Email: ${fee.user.email}`);
    doc.text(`Batch: ${fee.user.batch || 'N/A'}`);
    doc.text(`Room No: ${fee.user.roomNo || 'N/A'}`);
    doc.text(`Phone: ${fee.user.phone || 'N/A'}`);
    doc.moveDown();

    doc.text(`Fee Type: ${fee.feeType.toUpperCase()}`);
    doc.text(`Amount: ₹${fee.amount}`);
    doc.text(`Status: ${fee.status.toUpperCase()}`);
    doc.moveDown();

    doc.fontSize(10).text('This is a computer-generated receipt.', { align: 'center' });
    doc.text('Thank you for your payment!', { align: 'center' });
    doc.end();
  } catch (error) {
    console.error('Generate receipt error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate receipt' });
  }
});

/**
 * @route GET /api/fees/stats/overview
 * @desc Get fee statistics
 */
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate || endDate) filter.dueDate = {};
    if (startDate) filter.dueDate.$gte = new Date(startDate);
    if (endDate) filter.dueDate.$lte = new Date(endDate);

    const totalFees = await Fee.countDocuments(filter);
    const paidFees = await Fee.countDocuments({ ...filter, status: 'paid' });
    const pendingFees = await Fee.countDocuments({ ...filter, status: 'pending' });
    const overdueFees = await Fee.countDocuments({ ...filter, status: 'overdue' });

    const totalCollected = await Fee.aggregate([
      { $match: { ...filter, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const monthlyData = await Fee.aggregate([
      { $match: { status: 'paid', paidDate: { $ne: null } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$paidDate' } },
          count: { $sum: 1 },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id': 1 } },
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          total_fees: totalFees,
          paid_fees: paidFees,
          pending_fees: pendingFees,
          overdue_fees: overdueFees,
          total_collected: totalCollected[0]?.total || 0,
        },
        monthlyData,
      },
    });
  } catch (error) {
    console.error('Get fee stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fee stats' });
  }
});

/**
 * @route PUT /api/fees/update-overdue
 * @desc Mark all past-due pending fees as overdue
 */
router.put('/update-overdue', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await Fee.updateMany(
      { status: 'pending', dueDate: { $lt: new Date() } },
      { $set: { status: 'overdue' } }
    );
    res.json({ success: true, message: `Updated ${result.modifiedCount} fees to overdue` });
  } catch (error) {
    console.error('Update overdue error:', error);
    res.status(500).json({ success: false, message: 'Failed to update overdue fees' });
  }
});

export default router;

