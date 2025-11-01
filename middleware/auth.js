const jwt = require('jsonwebtoken');
const User = require('../models/user'); // ✅ use Mongoose model instead of old SQL db

// ✅ Authenticate JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Fetch user from MongoDB
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or token invalid',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

// ✅ Role-based access control
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }

    next();
  };
};

// ✅ Predefined helpers
const requireAdmin = requireRole(['admin']);
const requireStudent = requireRole(['student']);
const requireAnyRole = requireRole(['admin', 'student', 'warden']); // added warden also

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireStudent,
  requireAnyRole,
};
