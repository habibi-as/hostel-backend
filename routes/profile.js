import express from "express";
import { getProfile, updateProfile } from "../controllers/profileController.js";
import { authenticateToken, requireStudent } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticateToken, requireStudent, getProfile);
router.put("/", authenticateToken, requireStudent, updateProfile);

export default router;
