const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, requireAnyRole } = require('../middleware/auth');
const FoodMenu = require('../models/FoodMenu');

const router = express.Router();

// GET food menu (Admin & Student)
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { day, mealType } = req.query;

    const filter = {};
    if (day) filter.dayOfWeek = day;
    if (mealType) filter.mealType = mealType;

    const menu = await FoodMenu.find(filter).sort({ dayOfWeek: 1, mealType: 1 });

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

// UPDATE food menu (Admin only)
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

    const menu = await FoodMenu.findByIdAndUpdate(
      id,
      { menuItems, updatedAt: new Date() },
      { new: true }
    );

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: 'Menu not found'
      });
    }

    res.json({
      success: true,
      message: 'Food menu updated successfully',
      data: menu
    });

  } catch (error) {
    console.error('Update food menu error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update food menu'
    });
  }
});

export default router;

