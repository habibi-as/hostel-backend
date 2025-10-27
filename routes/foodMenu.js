const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');

const router = express.Router();

// Get food menu
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { day, mealType } = req.query;

    let query = 'SELECT * FROM food_menu WHERE 1=1';
    let params = [];

    if (day) {
      query += ' AND day_of_week = ?';
      params.push(day);
    }

    if (mealType) {
      query += ' AND meal_type = ?';
      params.push(mealType);
    }

    query += ' ORDER BY day_of_week, meal_type';

    const [menu] = await db.promise().execute(query, params);

    res.json({
      success: true,
      data: menu
    });

  } catch (error) {
    console.error('Get food menu error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch food menu'
    });
  }
});

// Update food menu (Admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('menuItems').notEmpty().withMessage('Menu items are required')
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
    const { menuItems } = req.body;

    await db.promise().execute(
      'UPDATE food_menu SET menu_items = ? WHERE id = ?',
      [menuItems, id]
    );

    res.json({
      success: true,
      message: 'Food menu updated successfully'
    });

  } catch (error) {
    console.error('Update food menu error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update food menu'
    });
  }
});

module.exports = router;
