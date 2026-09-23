require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

/* ============ MIDDLEWARE ============ */
app.use(cors());
app.use(express.json());

/* ============ API KEY CHECK (for extension) ============ */
function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (key !== process.env.API_KEY) {
    return res.status(401).json({ ok: false, error: "Invalid API key" });
  }
  next();
}

/* ============ ROUTES ============ */
app.use("/api/auth", require("./routes/auth"));
app.use("/api/redeem", requireApiKey, require("./routes/redeem"));
app.use("/api/status", requireApiKey, require("./routes/status"));
app.use("/api/servers", require("./routes/servers"));
app.use("/api/admin", require("./routes/admin")); // admin has its own JWT middleware

/* ============ HEALTH CHECK ============ */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Lame VPN API",
    version: "1.0.0",
    author: "Umar Rehman"
  });
});
/* ============ PUBLIC BANNER (for extension) ============ */
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

/* ============ DEBUG ============ */
app.get("/debug", (req, res) => {
  res.json({
    adminKeyLength: process.env.ADMIN_KEY ? process.env.ADMIN_KEY.length : 0,
    apiKeyValue: process.env.API_KEY || "(not loaded)",
    adminPasswordSet: !!process.env.ADMIN_PASSWORD,
    jwtSecretSet: !!process.env.JWT_SECRET,
    mongoConnected: mongoose.connection.readyState === 1
  });
});

/* ============ START SERVER ============ */
const PORT = process.env.PORT || 3000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, "0.0.0.0", () => console.log(`🍋 Lame VPN API running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });