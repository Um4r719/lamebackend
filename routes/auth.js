const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

/* ============ POST /api/auth/login ============ */
router.post("/login", (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ ok: false, error: "Password required" });
    }

    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ ok: false, error: "Invalid password" });
    }

    // Generate JWT token (valid 24 hours)
    const token = jwt.sign(
      { role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({ ok: true, token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* ============ POST /api/auth/verify ============ */
router.post("/verify", (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.json({ ok: false });

    jwt.verify(token, process.env.JWT_SECRET);
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false });
  }
});

module.exports = router;