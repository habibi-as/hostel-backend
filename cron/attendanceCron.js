const cron = require('node-cron');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const User = require('../models/user');

/**
 * Cron job that runs at 23:59 every day (server time) and:
 * - finds sessions that expired today and are still active
 * - for each such session, mark students who don't have a record as 'absent'
 */
const runDailyMarkAbsent = () => {
  // schedule: every day at 23:59
  cron.schedule('59 23 * * *', async () => {
    console.log('[attendanceCron] Running daily absent marking job');

    try {
      // find sessions that expired (expiresAt < now) and still active
      const expiredSessions = await AttendanceSession.find({
        expiresAt: { $lt: new Date() },
        active: true
      });

      if (!expiredSessions.length) {
        console.log('[attendanceCron] No expired active sessions found');
        return;
      }

      // Get list of all students
      const students = await User.find({ role: 'student' }).select('_id');

      for (const session of expiredSessions) {
        const sessionId = session._id;
        const today = new Date().toISOString().split('T')[0];

        // find user ids who already have attendance for this session
        const records = await AttendanceRecord.find({ session: sessionId }).select('user');
        const markedUserIds = records.map(r => r.user.toString());

        // for each student not in markedUserIds -> insert 'absent' record
        const toMark = students.filter(s => !markedUserIds.includes(s._id.toString()));

        if (toMark.length === 0) {
          // nothing to mark
          session.active = false;
          await session.save();
          continue;
        }

        const bulkOps = toMark.map(s => ({
          insertOne: {
            document: {
              session: sessionId,
              user: s._id,
              date: today,
              status: 'absent',
              checkInTime: null,
              createdAt: new Date()
            }
          }
        }));

        if (bulkOps.length) {
          await AttendanceRecord.bulkWrite(bulkOps);
        }

        // mark session inactive so we don't re-process
        session.active = false;
        await session.save();

        console.log(`[attendanceCron] Marked ${bulkOps.length} absent for session ${sessionId}`);
      }
    } catch (err) {
      console.error('[attendanceCron] Error during daily job', err);
    }
  }, {
    scheduled: true,
    timezone: 'UTC' // change to your server timezone if needed
  });
};

module.exports = runDailyMarkAbsent;
