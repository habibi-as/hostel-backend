const express = require('express');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Generate attendance report
router.get('/attendance', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, batch, format = 'json' } = req.query;

    let query = `
      SELECT 
        a.date,
        a.status,
        a.check_in_time,
        a.check_out_time,
        u.name,
        u.email,
        u.batch,
        u.room_no
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE u.role = 'student' AND u.is_active = TRUE
    `;
    let params = [];

    if (startDate) {
      query += ' AND a.date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND a.date <= ?';
      params.push(endDate);
    }

    if (batch) {
      query += ' AND u.batch = ?';
      params.push(batch);
    }

    query += ' ORDER BY a.date DESC, u.name';

    const [attendance] = await db.promise().execute(query, params);

    if (format === 'pdf') {
      // Generate PDF report
      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.pdf"');

      doc.pipe(res);

      // Header
      doc.fontSize(20).text('ATTENDANCE REPORT', { align: 'center' });
      doc.fontSize(12).text('Hostel Management System', { align: 'center' });
      doc.moveDown();

      // Report details
      doc.fontSize(14).text('Report Details:', { underline: true });
      doc.moveDown(0.5);
      doc.text(`Period: ${startDate || 'All time'} to ${endDate || 'Current'}`);
      if (batch) doc.text(`Batch: ${batch}`);
      doc.text(`Total Records: ${attendance.length}`);
      doc.moveDown();

      // Table header
      doc.text('Date\t\tName\t\tBatch\t\tRoom\t\tStatus\t\tTime');
      doc.text('─'.repeat(80));

      // Table data
      attendance.forEach(record => {
        doc.text(`${record.date}\t${record.name}\t${record.batch}\t${record.room_no}\t${record.status}\t${record.check_in_time || 'N/A'}`);
      });

      doc.end();
    } else if (format === 'excel') {
      // Generate Excel report
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Attendance Report');

      worksheet.columns = [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Name', key: 'name', width: 20 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Batch', key: 'batch', width: 15 },
        { header: 'Room', key: 'room_no', width: 10 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Check In', key: 'check_in_time', width: 12 },
        { header: 'Check Out', key: 'check_out_time', width: 12 }
      ];

      attendance.forEach(record => {
        worksheet.addRow(record);
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.xlsx"');

      await workbook.xlsx.write(res);
      res.end();
    } else {
      // Return JSON
      res.json({
        success: true,
        data: attendance
      });
    }

  } catch (error) {
    console.error('Generate attendance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate attendance report'
    });
  }
});

// Generate payment report
router.get('/payments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, status, format = 'json' } = req.query;

    let query = `
      SELECT 
        f.amount,
        f.fee_type,
        f.status,
        f.due_date,
        f.paid_date,
        f.receipt_no,
        u.name,
        u.email,
        u.batch,
        u.room_no
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

    if (status) {
      query += ' AND f.status = ?';
      params.push(status);
    }

    query += ' ORDER BY f.due_date DESC';

    const [payments] = await db.promise().execute(query, params);

    if (format === 'pdf') {
      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="payment-report.pdf"');

      doc.pipe(res);

      doc.fontSize(20).text('PAYMENT REPORT', { align: 'center' });
      doc.fontSize(12).text('Hostel Management System', { align: 'center' });
      doc.moveDown();

      doc.fontSize(14).text('Report Details:', { underline: true });
      doc.moveDown(0.5);
      doc.text(`Period: ${startDate || 'All time'} to ${endDate || 'Current'}`);
      if (status) doc.text(`Status: ${status}`);
      doc.text(`Total Records: ${payments.length}`);
      doc.moveDown();

      doc.text('Due Date\t\tName\t\tBatch\t\tAmount\t\tStatus\t\tPaid Date');
      doc.text('─'.repeat(80));

      payments.forEach(payment => {
        doc.text(`${payment.due_date}\t${payment.name}\t${payment.batch}\t₹${payment.amount}\t${payment.status}\t${payment.paid_date || 'N/A'}`);
      });

      doc.end();
    } else {
      res.json({
        success: true,
        data: payments
      });
    }

  } catch (error) {
    console.error('Generate payment report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate payment report'
    });
  }
});

// Generate complaint report
router.get('/complaints', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, status, category, format = 'json' } = req.query;

    let query = `
      SELECT 
        c.category,
        c.title,
        c.description,
        c.status,
        c.priority,
        c.created_at,
        u.name,
        u.email,
        u.batch,
        u.room_no
      FROM complaints c
      JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;
    let params = [];

    if (startDate) {
      query += ' AND DATE(c.created_at) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND DATE(c.created_at) <= ?';
      params.push(endDate);
    }

    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }

    if (category) {
      query += ' AND c.category = ?';
      params.push(category);
    }

    query += ' ORDER BY c.created_at DESC';

    const [complaints] = await db.promise().execute(query, params);

    res.json({
      success: true,
      data: complaints
    });

  } catch (error) {
    console.error('Generate complaint report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate complaint report'
    });
  }
});

module.exports = router;
