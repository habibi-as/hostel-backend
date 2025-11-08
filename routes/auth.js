// 🟢 Get User Profile (Final Fixed)
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    // If the middleware already attached full user:
    if (req.user && req.user._id) {
      return res.json({
        success: true,
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
        },
      });
    }

    // Fallback — if only ID was attached in token:
    const user = await User.findById(req.user.id || req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user profile",
    });
  }
});

