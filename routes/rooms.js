import express from "express";
import Room from "../models/Room.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const router = express.Router();


// Get all rooms
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', type = '', floor = '', status = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT r.*, 
             GROUP_CONCAT(u.name SEPARATOR ', ') as occupants
      FROM rooms r
      LEFT JOIN users u ON r.room_no = u.room_no AND u.role = 'student' AND u.is_active = TRUE
      WHERE 1=1
    `;
    let params = [];

    if (search) {
      query += ' AND r.room_no LIKE ?';
      params.push(`%${search}%`);
    }

    if (type) {
      query += ' AND r.type = ?';
      params.push(type);
    }

    if (floor) {
      query += ' AND r.floor = ?';
      params.push(floor);
    }

    if (status === 'vacant') {
      query += ' AND r.occupied = 0';
    } else if (status === 'occupied') {
      query += ' AND r.occupied > 0';
    }

    query += ' GROUP BY r.id ORDER BY r.room_no LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rooms] = await db.promise().execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM rooms WHERE 1=1';
    let countParams = [];

    if (search) {
      countQuery += ' AND room_no LIKE ?';
      countParams.push(`%${search}%`);
    }

    if (type) {
      countQuery += ' AND type = ?';
      countParams.push(type);
    }

    if (floor) {
      countQuery += ' AND floor = ?';
      countParams.push(floor);
    }

    if (status === 'vacant') {
      countQuery += ' AND occupied = 0';
    } else if (status === 'occupied') {
      countQuery += ' AND occupied > 0';
    }

    const [countResult] = await db.promise().execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        rooms,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rooms'
    });
  }
});

// Get room by ID
router.get('/:id', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { id } = req.params;

    const [rooms] = await db.promise().execute(
      'SELECT * FROM rooms WHERE id = ?',
      [id]
    );

    if (rooms.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Get room occupants
    const [occupants] = await db.promise().execute(
      'SELECT id, name, email, phone, photo FROM users WHERE room_no = ? AND role = "student" AND is_active = TRUE',
      [rooms[0].room_no]
    );

    res.json({
      success: true,
      data: {
        ...rooms[0],
        occupants
      }
    });

  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch room'
    });
  }
});

// Create room (Admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('room_no').notEmpty().withMessage('Room number is required'),
  body('capacity').isInt({ min: 1, max: 10 }).withMessage('Capacity must be between 1 and 10'),
  body('type').isIn(['single', 'double', 'triple', 'quad']).withMessage('Invalid room type')
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

    const { room_no, capacity, type, floor } = req.body;

    // Check if room already exists
    const [existingRoom] = await db.promise().execute(
      'SELECT id FROM rooms WHERE room_no = ?',
      [room_no]
    );

    if (existingRoom.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Room already exists'
      });
    }

    // Create room
    const [result] = await db.promise().execute(
      'INSERT INTO rooms (room_no, capacity, type, floor) VALUES (?, ?, ?, ?)',
      [room_no, capacity, type, floor]
    );

    res.status(201).json({
      success: true,
      message: 'Room created successfully',
      data: {
        id: result.insertId,
        room_no,
        capacity,
        type,
        floor
      }
    });

  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create room'
    });
  }
});

// Update room (Admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('capacity').optional().isInt({ min: 1, max: 10 }).withMessage('Capacity must be between 1 and 10'),
  body('type').optional().isIn(['single', 'double', 'triple', 'quad']).withMessage('Invalid room type')
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

    const { id } = req.params;
    const { capacity, type, floor, is_active } = req.body;

    // Check if room exists
    const [existingRoom] = await db.promise().execute(
      'SELECT * FROM rooms WHERE id = ?',
      [id]
    );

    if (existingRoom.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const currentRoom = existingRoom[0];

    // Check if new capacity is less than current occupancy
    if (capacity && capacity < currentRoom.occupied) {
      return res.status(400).json({
        success: false,
        message: 'New capacity cannot be less than current occupancy'
      });
    }

    let updateFields = [];
    let values = [];

    if (capacity !== undefined) {
      updateFields.push('capacity = ?');
      values.push(capacity);
    }
    if (type) {
      updateFields.push('type = ?');
      values.push(type);
    }
    if (floor !== undefined) {
      updateFields.push('floor = ?');
      values.push(floor);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      values.push(is_active);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(id);

    await db.promise().execute(
      `UPDATE rooms SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Room updated successfully'
    });

  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update room'
    });
  }
});

// Delete room (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [rooms] = await db.promise().execute(
      'SELECT room_no, occupied FROM rooms WHERE id = ?',
      [id]
    );

    if (rooms.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    if (rooms[0].occupied > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete room with occupants'
      });
    }

    await db.promise().execute('DELETE FROM rooms WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Room deleted successfully'
    });

  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete room'
    });
  }
});

// ✅ Export router
export default router;

