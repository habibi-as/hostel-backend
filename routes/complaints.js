const express = require('express');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const Attendance = require('../models/attendance');
const Fee = require('../models/Fee');
const Complaint = require('../models/Complaint');
const User = require('../models/user');

const router = express.Router();

// 📘 Attendance Report
router.get('/attendance', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, batch, format = 'json' } = req.query;
    const filter = {};

    if (startDate || endDate) filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate);
    if (batch) filter.batch = batch;

    const attendance = await Attendance.find(filter)
      .populate('user', 'name email batch room_no')
      .sort({ date: -1 });

    if (format === 'pdf') {
      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.pdf"');
      doc.pipe(res);

      doc.fontSize(20).text('ATTENDANCE REPORT', { align: 'center' });
      doc.fontSize(12).text('Hostel Management System', { align: 'center' });
      doc.moveDown();

      doc.fontSize(14).text('Report Details:', { underline: true });
      doc.moveDown(0.5);
      doc.text(`Period: ${startDate || 'All time'} to ${endDate || 'Current'}`);
      if (batch) doc.text(`Batch: ${batch}`);
      doc.text(`Total Records: ${attendance.length}`);
      doc.moveDown();

      attendance.forEach(a => {
        doc.text(`${a.date.toDateString()} - ${a.user?.name || 'N/A'} (${a.user?.batch || '-'}) | ${a.status} | In: ${a.checkIn || 'N/A'} Out: ${a.checkOut || 'N/A'}`);
      });

      doc.end();
    } else if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Attendance Report');

      sheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Name', key: 'name', width: 20 },
        { header: 'Batch', key: 'batch', width: 15 },
        { header: 'Room No', key: 'room_no', width: 10 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Check In', key: 'checkIn', width: 15 },
        { header: 'Check Out', key: 'checkOut', width: 15 },
      ];

      attendance.forEach(a => {
        sheet.addRow({
          date: a.date.toDateString(),
          name: a.user?.name,
          batch: a.user?.batch,
          room_no: a.user?.room_no,
          status: a.status,
          checkIn: a.checkIn || 'N/A',
          checkOut: a.checkOut || 'N/A'
        });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.xlsx"');
      await workbook.xlsx.write(res);
      res.end();
    } else {
      res.json({ success: true, data: attendance });
    }
  } catch (err) {
    console.error('Attendance Report Error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate attendance report' });
  }
});

// 💰 Fee / Payment Report
router.get('/payments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, status, format = 'json' } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (startDate || endDate) filter.dueDate = {};
    if (startDate) filter.dueDate.$gte = new Date(startDate);
    if (endDate) filter.dueDate.$lte = new Date(endDate);

    const payments = await Fee.find(filter)
      .populate('user', 'name email batch room_no')
      .sort({ dueDate: -1 });

    if (format === 'pdf') {
      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="payment-report.pdf"');
      doc.pipe(res);

      doc.fontSize(20).text('PAYMENT REPORT', { align: 'center' });
      doc.moveDown();
      doc.text(`Period: ${startDate || 'All'} - ${endDate || 'Now'}`);
      doc.text(`Total: ${payments.length}`);
      doc.moveDown();

      payments.forEach(p => {
        doc.text(`${p.user?.name || 'N/A'} | ₹${p.amount} | ${p.feeType} | ${p.status} | Due: ${p.dueDate?.toDateString()} | Paid: ${p.paidDate ? p.paidDate.toDateString() : 'N/A'}`);
      });

      doc.end();
    } else {
      res.json({ success: true, data: payments });
    }
  } catch (err) {
    console.error('Payment Report Error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate payment report' });
  }
});

// 🧾 Complaint Report
router.get('/complaints', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, status, category } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (startDate || endDate) filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);

    const complaints = await Complaint.find(filter)
      .populate('user', 'name email batch room_no')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: complaints });
  } catch (err) {
    console.error('Complaint Report Error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate complaint report' });
  }
});

module.exports = router;
