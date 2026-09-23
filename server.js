/* =====================================================
   Lame VPN — Backend Server
   Design By Umar Rehman
   ===================================================== */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

const app = express();

/* ============ MIDDLEWARE ============ */
app.use(cors());
app.use(express.json());

/* ============ SECURITY HEADERS ============ */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

/* ============ API KEY CHECK (for extension) ============ */
function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (key !== process.env.API_KEY) {
    return res.status(401).json({ ok: false, error: "Invalid API key" });
  }
  next();
}

/* =====================================================
   ADMIN PANEL ROUTES
   ===================================================== */

/* Admin panel — /admin */
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

/* Admin panel — /admin.html (direct) */
app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

/* Optional: Secret admin path (more secure) */
app.get("/lame-admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

/* ============ ICONS (agar extension icons chahiye) ============ */
app.get("/icons/:file", (req, res) => {
  res.sendFile(path.join(__dirname, "icons", req.params.file));
});

/* =====================================================
   HEALTH CHECK
   ===================================================== */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Lame VPN API",
    version: "1.0.0",
    author: "Umar Rehman"
  });
});

/* =====================================================
   DEBUG
   ===================================================== */
app.get("/debug", (req, res) => {
  res.json({
    adminKeyLength: process.env.ADMIN_KEY ? process.env.ADMIN_KEY.length : 0,
    apiKeyValue: process.env.API_KEY || "(not loaded)",
    adminPasswordSet: !!process.env.ADMIN_PASSWORD,
    jwtSecretSet: !!process.env.JWT_SECRET,
    mongoUriSet: !!process.env.MONGODB_URI,
    mongoUriLength: process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 0,
    mongoConnected: mongoose.connection.readyState === 1,
    nodeVersion: process.version,
    env: process.env.NODE_ENV || "development"
  });
});

/* =====================================================
   PUBLIC BANNER (for extension)
   ===================================================== */
app.get("/api/banner", async (req, res) => {
  const key = req.headers["x-api-key"];
  if (key !== process.env.API_KEY) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const Banner = require("./models/Banner");
    let banner = await Banner.findOne({ id: "main" });

    if (!banner) {
      return res.json({ ok: true, banner: { active: false } });
    }

    res.json({
      ok: true,
      banner: {
        id: banner.id,
        active: banner.active,
        icon: banner.icon,
        text: banner.text,
        color: banner.color,
        updatedAt: banner.updatedAt
      }
    });
  } catch (err) {
    console.error("Public banner error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* =====================================================
   ROUTES
   ===================================================== */
app.use("/api/auth", require("./routes/auth"));
app.use("/api/redeem", requireApiKey, require("./routes/redeem"));
app.use("/api/status", requireApiKey, require("./routes/status"));
app.use("/api/servers", require("./routes/servers"));
app.use("/api/admin", require("./routes/admin"));

/* =====================================================
   404 HANDLER
   ===================================================== */
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Route not found",
    path: req.path
  });
});

/* =====================================================
   ERROR HANDLER
   ===================================================== */
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

/* =====================================================
   START SERVER
   ===================================================== */
const PORT = process.env.PORT || 3000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🍋 Lame VPN API running on port ${PORT}`);
      console.log(`📊 Admin panel: http://localhost:${PORT}/admin`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });
