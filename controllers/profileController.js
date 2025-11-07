import User from '../models/user.js';

export const getProfile = async (req, res) => {
  try {
    const student = await User.findById(req.user.id).select('-password');
    res.json({ success: true, student });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const updates = { phone: req.body.phone, profilePic: req.body.profilePic };
    const student = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json({ success: true, message: 'Profile updated successfully', student });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
};
