const express = require('express');
const PDFDocument = require('pdfkit');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

// Get fees for a user
router.get('/user/:userId', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const currentUser = req.user;

    // Students can only view their own fees
    if (currentUser.role === 'student' && parseInt(userId) !== currentUser.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    let query = `
      SELECT f.*, u.name, u.email, u.batch, u.room_no
      FROM fees f
      JOIN users u ON f.user_id = u.id
      WHERE f.user_id = ?
    `;
    let params = [userId];

    if (status) {
      query += ' AND f.status = ?';
      params.push(status);
    }

    query += ' ORDER BY f.due_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [fees] = await db.promise().execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM fees WHERE user_id = ?';
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
        fees,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get user fees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fees'
    });
  }
});

// Get all fees (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, batch, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT f.*, u.name, u.email, u.batch, u.room_no
      FROM fees f
      JOIN users u ON f.user_id = u.id
      WHERE u.role = 'student' AND u.is_active = TRUE
    `;
    let params = [];

    if (status) {
      query += ' AND f.status = ?';
      params.push(status);
    }

    if (batch) {
      query += ' AND u.batch = ?';
      params.push(batch);
    }

    query += ' ORDER BY f.due_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [fees] = await db.promise().execute(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM fees f
      JOIN users u ON f.user_id = u.id
      WHERE u.role = 'student' AND u.is_active = TRUE
    `;
    let countParams = [];

    if (status) {
      countQuery += ' AND f.status = ?';
      countParams.push(status);
    }

    if (batch) {
      countQuery += ' AND u.batch = ?';
      countParams.push(batch);
    }

    const [countResult] = await db.promise().execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        fees,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get all fees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fees'
    });
  }
});

// Create fee (Admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('userId').isInt().withMessage('Valid user ID is required'),
  body('amount').isDecimal().withMessage('Valid amount is required'),
  body('feeType').isIn(['monthly', 'semester', 'annual', 'late_fee']).withMessage('Invalid fee type'),
  body('dueDate').isISO8601().withMessage('Valid due date is required')
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

    const { userId, amount, feeType, dueDate, description } = req.body;

    // Check if user exists
    const [users] = await db.promise().execute(
      'SELECT id, name FROM users WHERE id = ? AND role = "student" AND is_active = TRUE',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Create fee
    const [result] = await db.promise().execute(
      'INSERT INTO fees (user_id, amount, fee_type, due_date, description) VALUES (?, ?, ?, ?, ?)',
      [userId, amount, feeType, dueDate, description]
    );

    res.status(201).json({
      success: true,
      message: 'Fee created successfully',
      data: {
        id: result.insertId,
        userId,
        amount,
        feeType,
        dueDate
      }
    });

  } catch (error) {
    console.error('Create fee error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create fee'
    });
  }
});

// Mark fee as paid (Admin only)
router.put('/:id/pay', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { paidDate, receiptNo } = req.body;

    // Check if fee exists
    const [fees] = await db.promise().execute(
      'SELECT * FROM fees WHERE id = ?',
      [id]
    );

    if (fees.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fee not found'
      });
    }

    const fee = fees[0];

    if (fee.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Fee is already paid'
      });
    }

    // Update fee status
    await db.promise().execute(
      'UPDATE fees SET status = "paid", paid_date = ?, receipt_no = ? WHERE id = ?',
      [paidDate || new Date().toISOString().split('T')[0], receiptNo, id]
    );

    res.json({
      success: true,
      message: 'Fee marked as paid successfully'
    });

  } catch (error) {
    console.error('Mark fee paid error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark fee as paid'
    });
  }
});

// Generate fee receipt (PDF)
router.get('/:id/receipt', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Get fee details
    const [fees] = await db.promise().execute(`
      SELECT f.*, u.name, u.email, u.batch, u.room_no, u.phone
      FROM fees f
      JOIN users u ON f.user_id = u.id
      WHERE f.id = ?
    `, [id]);

    if (fees.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fee not found'
      });
    }

    const fee = fees[0];

    // Students can only view their own receipts
    if (currentUser.role === 'student' && fee.user_id !== currentUser.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (fee.status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Fee is not paid yet'
      });
    }

    // Create PDF
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${fee.receipt_no || fee.id}.pdf"`);

    doc.pipe(res);

    // Header
    doc.fontSize(20).text('HOSTEL FEE RECEIPT', { align: 'center' });
    doc.fontSize(12).text('Hostel Management System', { align: 'center' });
    doc.moveDown();

    // Receipt details
    doc.fontSize(14).text('Receipt Details:', { underline: true });
    doc.moveDown(0.5);

    doc.text(`Receipt No: ${fee.receipt_no || `REC-${fee.id}`}`);
    doc.text(`Date: ${fee.paid_date}`);
    doc.text(`Student Name: ${fee.name}`);
    doc.text(`Email: ${fee.email}`);
    doc.text(`Batch: ${fee.batch || 'N/A'}`);
    doc.text(`Room No: ${fee.room_no || 'N/A'}`);
    doc.text(`Phone: ${fee.phone || 'N/A'}`);
    doc.moveDown();

    doc.text(`Fee Type: ${fee.fee_type.toUpperCase()}`);
    doc.text(`Amount: ₹${fee.amount}`);
    doc.text(`Status: ${fee.status.toUpperCase()}`);
    doc.moveDown();

    // Footer
    doc.fontSize(10).text('This is a computer generated receipt.', { align: 'center' });
    doc.text('Thank you for your payment!', { align: 'center' });

    doc.end();

  } catch (error) {
    console.error('Generate receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate receipt'
    });
  }
});

// Get fee statistics (Admin only)
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT 
        COUNT(*) as total_fees,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_fees,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_fees,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_fees,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_collected,
        SUM(amount) as total_due
      FROM fees f
      JOIN users u ON f.user_id = u.id
      WHERE u.role = 'student' AND u.is_active = TRUE
    `;
    let params = [];

    if (startDate) {
      query += ' AND f.due_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND f.due_date <= ?';
      params.push(endDate);
    }

    const [stats] = await db.promise().execute(query, params);

    // Get monthly collection data
    const [monthlyData] = await db.promise().execute(`
      SELECT 
        DATE_FORMAT(paid_date, '%Y-%m') as month,
        COUNT(*) as count,
        SUM(amount) as total
      FROM fees 
      WHERE status = 'paid' 
        AND paid_date IS NOT NULL
        ${startDate ? 'AND paid_date >= ?' : ''}
        ${endDate ? 'AND paid_date <= ?' : ''}
      GROUP BY DATE_FORMAT(paid_date, '%Y-%m')
      ORDER BY month
    `, startDate && endDate ? [startDate, endDate] : []);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        monthlyData
      }
    });

  } catch (error) {
    console.error('Get fee stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee statistics'
    });
  }
});

// Get overdue fees (Admin only)
router.get('/overdue', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const [overdueFees] = await db.promise().execute(`
      SELECT f.*, u.name, u.email, u.batch, u.room_no
      FROM fees f
      JOIN users u ON f.user_id = u.id
      WHERE f.status = 'pending' 
        AND f.due_date < CURDATE()
        AND u.role = 'student' 
        AND u.is_active = TRUE
      ORDER BY f.due_date ASC
      LIMIT ? OFFSET ?
    `, [parseInt(limit), offset]);

    // Get total count
    const [countResult] = await db.promise().execute(`
      SELECT COUNT(*) as total 
      FROM fees f
      JOIN users u ON f.user_id = u.id
      WHERE f.status = 'pending' 
        AND f.due_date < CURDATE()
        AND u.role = 'student' 
        AND u.is_active = TRUE
    `);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        fees: overdueFees,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get overdue fees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch overdue fees'
    });
  }
});

// Update overdue fees status (Admin only)
router.put('/update-overdue', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Update all pending fees that are past due date
    const [result] = await db.promise().execute(`
      UPDATE fees 
      SET status = 'overdue' 
      WHERE status = 'pending' 
        AND due_date < CURDATE()
    `);

    res.json({
      success: true,
      message: `Updated ${result.affectedRows} fees to overdue status`
    });

  } catch (error) {
    console.error('Update overdue fees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update overdue fees'
    });
  }
});

module.exports = router;
