import Maintenance from '../models/Maintenance.js';

export const getMaintenance = async (req, res) => {
  try {
    const requests = await Maintenance.find({ student: req.user.id });
    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching maintenance requests' });
  }
};

export const addMaintenance = async (req, res) => {
  try {
    const { category, description, roomNumber } = req.body;
    if (!category || !description || !roomNumber)
      return res.status(400).json({ success: false, message: 'All fields are required' });

    const newRequest = new Maintenance({
      student: req.user.id,
      category,
      description,
      roomNumber,
    });

    await newRequest.save();
    res.json({ success: true, message: 'Maintenance request added', request: newRequest });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error submitting maintenance request' });
  }
};
