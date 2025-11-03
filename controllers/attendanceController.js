const QRCode = require('qrcode');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const User = require('../models/user');

// Helpers
const formatDate = (d) => d.toISOString().split('T')[0];
const formatTime = (d) => d.toTimeString().split(' ')[0];

// Create a new attendance session (admin/warden)
exports.createSession = async (req, res) => {
  try {
    const { title, startAt, durationHours = 24, lateAfterMinutes = 480 } = req.body;
    const start = startAt ? new Date(startAt) : new Date();
    const expires = new Date(start.getTime() + durationHours * 3600 * 1000);

    const session = new AttendanceSession({
      title,
      createdBy: req.user.id,
      startAt: start,
      expiresAt: expires,
      durationHours,
      lateAfterMinutes,
      active: true
    });

    await session.save();

    // Generate QR payload (we keep minimal info; sessionId is the key)
    const payload = { sessionId: session._id.toString() };
    const qrDataURL = await QRCode.toDataURL(JSON.stringify(payload), { width: 300, margin: 2 });

    res.status(201).json({
      success: true,
      message: 'Attendance session created',
      data: { session, qrCode: qrDataURL }
    });
  } catch (err) {
    console.error('createSession error', err);
    res.status(500).json({ success: false, message: 'Failed to create session' });
  }
};

// Get session info (admin or own)
exports.getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await AttendanceSession.findById(sessionId).populate('createdBy', 'name email');
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    res.json({ success: true, data: session });
  } catch (err) {
    console.error('getSession error', err);
    res.status(500).json({ success: false, message: 'Failed to fetch session' });
  }
};

// Mark attendance by scanning QR (students or admin)
exports.markAttendance = async (req, res) => {
  try {
    const { sessionId, qrData } = req.body;
    // allow either sessionId or qrData JSON (string)
    let targetSessionId = sessionId;
    if (!targetSessionId && qrData) {
      let parsed;
      try { parsed = typeof qrData === 'string' ? JSON.parse(qrData) : qrData; }
      catch (e) { return res.status(400).json({ success: false, message: 'Invalid QR data' }); }
      targetSessionId = parsed.sessionId;
    }
    if (!targetSessionId) return res.status(400).json({ success: false, message: 'Session ID required' });

    const session = await AttendanceSession.findById(targetSessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    // check active and not expired
    if (!session.active || new Date() > session.expiresAt) {
      return res.status(400).json({ success: false, message: 'Session is not active or already expired' });
    }

    const userId = req.user.id;

    // Students can only mark for themselves
    if (req.user.role === 'student' && req.user.id !== userId) {
      // req.user.id is always the userId — this check is placeholder for future use
    }

    const today = formatDate(new Date());
    const nowTime = formatTime(new Date());

    // Determine status: late if check-in minutes > startAt + lateAfterMinutes
    const startMs = session.startAt.getTime();
    const lateThresholdMs = startMs + session.lateAfterMinutes * 60 * 1000;
    const isLate = Date.now() > lateThresholdMs;
    const status = isLate ? 'late' : 'present';

    // Insert attendance record (unique index prevents duplicates)
    try {
      const rec = new AttendanceRecord({
        session: session._id,
        user: userId,
        date: today,
        status,
        checkInTime: nowTime
      });
      await rec.save();
      return res.json({ success: true, message: 'Attendance marked', data: { status, time: nowTime } });
    } catch (err) {
      // duplicate -> already marked
      if (err.code === 11000) {
        return res.status(400).json({ success: false, message: 'Attendance already marked for this session' });
      }
      throw err;
    }
  } catch (err) {
    console.error('markAttendance error', err);
    res.status(500).json({ success: false, message: 'Failed to mark attendance' });
  }
};

// Generate QR (dataURL) for a session (admin/warden)
exports.generateQRCode = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await AttendanceSession.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const payload = { sessionId: session._id.toString() };
    const qrDataURL = await QRCode.toDataURL(JSON.stringify(payload), { width: 300, margin: 2 });

    res.json({ success: true, data: { qrCode: qrDataURL } });
  } catch (err) {
    console.error('generateQRCode error', err);
    res.status(500).json({ success: false, message: 'Failed to generate QR' });
  }
};
