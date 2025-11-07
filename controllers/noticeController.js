import Notice from '../models/Notice.js';

export const getNotices = async (req, res) => {
  try {
    const notices = await Notice.find().sort({ date: -1 });
    res.json({ success: true, notices });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching notices' });
  }
};

export const addNotice = async (req, res) => {
  try {
    const { title, description, link } = req.body;
    if (!title || !description)
      return res.status(400).json({ success: false, message: 'All fields required' });

    const newNotice = new Notice({
      title,
      description,
      link,
      postedBy: req.user?.name || 'Admin',
    });

    await newNotice.save();
    res.json({ success: true, message: 'Notice added successfully', notice: newNotice });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding notice' });
  }
};
