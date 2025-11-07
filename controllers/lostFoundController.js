import LostFound from '../models/LostFound.js';

// Get all items
export const getAllLostFound = async (req, res) => {
  try {
    const items = await LostFound.find().populate('student', 'name');
    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching items' });
  }
};

// Post new item
export const addLostFound = async (req, res) => {
  try {
    const { itemName, description, type, location } = req.body;
    if (!itemName || !description || !type)
      return res.status(400).json({ success: false, message: 'All fields required' });

    const newItem = new LostFound({
      student: req.user.id,
      itemName,
      description,
      type,
      location,
    });

    await newItem.save();
    res.json({ success: true, message: 'Reported successfully', item: newItem });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error reporting item' });
  }
};
