import jwt from "jsonwebtoken";
import User from "../models/user.js"; // ✅ Make sure capitalization matches the file name exactly

// ✅ Authenticate JWT token
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Fetch user from MongoDB
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found or token invalid",
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// ✅ Generic role-based access control
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      });
    }

    next();
  };
};

// ✅ Predefined role helpers
export const requireAdmin = requireRole(["admin"]);
export const requireStudent = requireRole(["student"]);
export const requireAnyRole = requireRole(["admin", "student", "warden"]);
