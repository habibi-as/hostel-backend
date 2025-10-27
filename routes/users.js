const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Get all users (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role = '', batch = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, name, email, role, room_no, batch, phone, photo, is_active, created_at 
      FROM users 
      WHERE 1=1
    `;
    let params = [];

    if (search) {
      query += ' AND (name LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    if (batch) {
      query += ' AND batch = ?';
      params.push(batch);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [users] = await db.promise().execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    let countParams = [];

    if (search) {
      countQuery += ' AND (name LIKE ? OR email LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    if (role) {
      countQuery += ' AND role = ?';
      countParams.push(role);
    }

    if (batch) {
      countQuery += ' AND batch = ?';
      countParams.push(batch);
    }

    const [countResult] = await db.promise().execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Students can only view their own profile
    if (userRole === 'student' && parseInt(id) !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const [users] = await db.promise().execute(
      'SELECT id, name, email, role, room_no, batch, phone, photo, is_active, created_at FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: users[0]
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
});

// Create user (Admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['admin', 'student']).withMessage('Invalid role')
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

    const { name, email, password, role, room_no, batch, phone } = req.body;

    // Check if user already exists
    const [existingUser] = await db.promise().execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [result] = await db.promise().execute(
      'INSERT INTO users (name, email, password, role, room_no, batch, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role, room_no, batch, phone]
    );

    const userId = result.insertId;

    // If room is assigned, update room occupancy
    if (room_no) {
      await db.promise().execute(
        'UPDATE rooms SET occupied = occupied + 1 WHERE room_no = ?',
        [room_no]
      );
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: userId,
        name,
        email,
        role,
        room_no,
        batch,
        phone
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
});

// Update user
router.put('/:id', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Students can only update their own profile
    if (userRole === 'student' && parseInt(id) !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { name, email, room_no, batch, phone, is_active } = req.body;

    // Check if user exists
    const [existingUser] = await db.promise().execute(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const currentUser = existingUser[0];

    // Check if email is being changed and if it's already taken
    if (email && email !== currentUser.email) {
      const [emailCheck] = await db.promise().execute(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, id]
      );

      if (emailCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    let updateFields = [];
    let values = [];

    if (name) {
      updateFields.push('name = ?');
      values.push(name);
    }
    if (email) {
      updateFields.push('email = ?');
      values.push(email);
    }
    if (room_no !== undefined) {
      updateFields.push('room_no = ?');
      values.push(room_no);
    }
    if (batch) {
      updateFields.push('batch = ?');
      values.push(batch);
    }
    if (phone) {
      updateFields.push('phone = ?');
      values.push(phone);
    }
    if (is_active !== undefined && userRole === 'admin') {
      updateFields.push('is_active = ?');
      values.push(is_active);
    }
    if (req.file) {
      updateFields.push('photo = ?');
      values.push(req.file.filename);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(id);

    await db.promise().execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );

    // Handle room assignment changes (Admin only)
    if (userRole === 'admin' && room_no !== undefined) {
      const oldRoom = currentUser.room_no;
      
      // Decrease old room occupancy
      if (oldRoom) {
        await db.promise().execute(
          'UPDATE rooms SET occupied = occupied - 1 WHERE room_no = ?',
          [oldRoom]
        );
      }

      // Increase new room occupancy
      if (room_no) {
        await db.promise().execute(
          'UPDATE rooms SET occupied = occupied + 1 WHERE room_no = ?',
          [room_no]
        );
      }
    }

    res.json({
      success: true,
      message: 'User updated successfully'
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
});

// Delete user (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const [users] = await db.promise().execute(
      'SELECT room_no FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Delete user
    await db.promise().execute('DELETE FROM users WHERE id = ?', [id]);

    // Update room occupancy
    if (user.room_no) {
      await db.promise().execute(
        'UPDATE rooms SET occupied = occupied - 1 WHERE room_no = ?',
        [user.room_no]
      );
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
});

// Get dashboard stats (Admin only)
router.get('/stats/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Total students
    const [studentCount] = await db.promise().execute(
      'SELECT COUNT(*) as total FROM users WHERE role = "student" AND is_active = TRUE'
    );

    // Total rooms
    const [roomCount] = await db.promise().execute(
      'SELECT COUNT(*) as total FROM rooms WHERE is_active = TRUE'
    );

    // Occupied rooms
    const [occupiedRooms] = await db.promise().execute(
      'SELECT COUNT(*) as total FROM rooms WHERE occupied > 0 AND is_active = TRUE'
    );

    // Pending complaints
    const [pendingComplaints] = await db.promise().execute(
      'SELECT COUNT(*) as total FROM complaints WHERE status = "pending"'
    );

    // Total fees collected this month
    const [feesCollected] = await db.promise().execute(
      'SELECT COALESCE(SUM(amount), 0) as total FROM fees WHERE status = "paid" AND MONTH(paid_date) = MONTH(CURRENT_DATE()) AND YEAR(paid_date) = YEAR(CURRENT_DATE())'
    );

    res.json({
      success: true,
      data: {
        totalStudents: studentCount[0].total,
        totalRooms: roomCount[0].total,
        occupiedRooms: occupiedRooms[0].total,
        pendingComplaints: pendingComplaints[0].total,
        feesCollected: feesCollected[0].total
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats'
    });
  }
});

// Get students by batch
router.get('/batch/:batch', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { batch } = req.params;

    const [students] = await db.promise().execute(
      'SELECT id, name, email, room_no, phone, photo FROM users WHERE batch = ? AND role = "student" AND is_active = TRUE ORDER BY name',
      [batch]
    );

    res.json({
      success: true,
      data: students
    });

  } catch (error) {
    console.error('Get students by batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students'
    });
  }
});

// Get roommates
router.get('/room/:roomNo/roommates', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { roomNo } = req.params;

    const [roommates] = await db.promise().execute(
      'SELECT id, name, email, phone, photo FROM users WHERE room_no = ? AND role = "student" AND is_active = TRUE ORDER BY name',
      [roomNo]
    );

    res.json({
      success: true,
      data: roommates
    });

  } catch (error) {
    console.error('Get roommates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch roommates'
    });
  }
});

module.exports = router;
