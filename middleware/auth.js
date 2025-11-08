import jwt from "jsonwebtoken";
import User from "../models/user.js";

// ✅ Verify token and attach user ID + role
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

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Check if user still exists in DB
    const userExists = await User.findById(decoded.id).select("_id role");
    if (!userExists) {
      return res.status(401).json({
        success: false,
        message: "User not found or token invalid",
      });
    }

    // ✅ Attach only lightweight info for later use
    req.user = {
      id: userExists._id.toString(),
      role: userExists.role,
    };

    next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// ✅ Role-based access control
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
