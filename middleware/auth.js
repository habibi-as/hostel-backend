import jwt from "jsonwebtoken";
import User from "../models/user.js";

/* =========================================================
   🟢 AUTHENTICATE TOKEN
========================================================= */
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

    // ✅ Fetch user details from DB
    const user = await User.findById(decoded.id).select("_id name email role");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found or token invalid",
      });
    }

    // ✅ Attach user info to req for downstream routes
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
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

/* =========================================================
   🟢 ROLE-BASED ACCESS CONTROL
========================================================= */
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

// ✅ Predefined helpers for clarity
export const requireAdmin = requireRole(["admin"]);
export const requireStudent = requireRole(["student"]);
export const requireAnyRole = requireRole(["admin", "student", "warden"]);
