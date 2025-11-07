import Visitor from '../models/Visitor.js';

export const getVisitors = async (req, res) => {
  try {
    const visitors = await Visitor.find({ student: req.user.id });
    res.json({ success: true, visitors });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching visitors' });
  }
};

export const addVisitor = async (req, res) => {
  try {
    const { visitorName, purpose, visitDate } = req.body;
    if (!visitorName || !purpose || !visitDate)
      return res.status(400).json({ success: false, message: 'All fields are required' });

    const newVisitor = new Visitor({
      student: req.user.id,
      visitorName,
      purpose,
      visitDate,
    });

    await newVisitor.save();
    res.json({ success: true, message: 'Visitor request added', visitor: newVisitor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding visitor' });
  }
};
