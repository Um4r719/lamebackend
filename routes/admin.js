const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Code = require("../models/Code");
const Device = require("../models/Device");
const Server = require("../models/Server");

/* =====================================================
   AUTH MIDDLEWARE — JWT or adminKey
   ===================================================== */
function requireAdmin(req, res, next) {
  // 1️⃣ Try JWT token from Authorization header
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      jwt.verify(token, process.env.JWT_SECRET);
      return next(); // ✅ valid token
    } catch (err) {
      // Invalid token → fall through to adminKey
    }
  }

  // 2️⃣ Fallback: adminKey (backward compatible)
  const adminKey =
    (req.body && req.body.adminKey) ||
    (req.query && req.query.adminKey) ||
    req.headers["x-admin-key"];

  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  next();
}

/* ============ Generate unique 6-digit code ============ */
async function generateUniqueCode() {
  let code;
  let exists = true;
  while (exists) {
    code = String(Math.floor(100000 + Math.random() * 900000));
    exists = await Code.findOne({ code });
  }
  return code;
}

/* =====================================================
   GENERATE CODES
   ===================================================== */
router.post("/generate", requireAdmin, async (req, res) => {
  try {
    const {
      days = 30,
      maxDevices = 5,
      count = 1
    } = req.body;

    if (count < 1 || count > 100) {
      return res.status(400).json({ ok: false, error: "count must be 1-100" });
    }
    if (days < 1 || days > 3650) {
      return res.status(400).json({ ok: false, error: "days must be 1-3650" });
    }
    if (maxDevices < 1 || maxDevices > 100) {
      return res.status(400).json({ ok: false, error: "maxDevices must be 1-100" });
    }

    const codes = [];
    for (let i = 0; i < count; i++) {
      const newCode = await generateUniqueCode();
      codes.push(newCode);
      await Code.create({
        code: newCode,
        days,
        maxDevices
      });
    }

    res.json({ ok: true, codes, days, maxDevices });
  } catch (err) {
    console.error("Generate error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* =====================================================
   LIST ALL CODES
   ===================================================== */
router.get("/codes", requireAdmin, async (req, res) => {
  try {
    const codes = await Code.find().sort({ createdAt: -1 }).limit(500);
    res.json({ ok: true, codes });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* =====================================================
   GET SINGLE CODE
   ===================================================== */
router.get("/code/:code", requireAdmin, async (req, res) => {
  try {
    const code = await Code.findOne({ code: req.params.code.toUpperCase() });
    if (!code) {
      return res.json({ ok: false, error: "Code not found" });
    }
    res.json({ ok: true, code });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* =====================================================
   EXTEND CODE
   ===================================================== */
router.post("/extend", requireAdmin, async (req, res) => {
  try {
    const { code, extraDays } = req.body;

    if (!code || !extraDays || extraDays < 1) {
      return res.status(400).json({ ok: false, error: "Invalid input" });
    }

    const codeDoc = await Code.findOne({ code: code.toUpperCase() });
    if (!codeDoc) {
      return res.json({ ok: false, error: "Code not found" });
    }

    if (codeDoc.expiresAt) {
      codeDoc.expiresAt = new Date(
        codeDoc.expiresAt.getTime() + extraDays * 24 * 60 * 60 * 1000
      );
    }
    codeDoc.days = (codeDoc.days || 30) + extraDays;
    await codeDoc.save();

    res.json({
      ok: true,
      code: codeDoc.code,
      newExpiry: codeDoc.expiresAt,
      totalDays: codeDoc.days
    });
  } catch (err) {
    console.error("Extend error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* =====================================================
   REDUCE CODE
   ===================================================== */
router.post("/reduce", requireAdmin, async (req, res) => {
  try {
    const { code, reduceDays } = req.body;

    if (!code || !reduceDays || reduceDays < 1) {
      return res.status(400).json({ ok: false, error: "Invalid input" });
    }

    const codeDoc = await Code.findOne({ code: code.toUpperCase() });
    if (!codeDoc) {
      return res.json({ ok: false, error: "Code not found" });
    }

    if (codeDoc.expiresAt) {
      const newExpiry = new Date(
        codeDoc.expiresAt.getTime() - reduceDays * 24 * 60 * 60 * 1000
      );
      codeDoc.expiresAt = newExpiry < new Date() ? new Date() : newExpiry;
    }
    codeDoc.days = Math.max(0, (codeDoc.days || 30) - reduceDays);
    await codeDoc.save();

    res.json({
      ok: true,
      code: codeDoc.code,
      newExpiry: codeDoc.expiresAt,
      totalDays: codeDoc.days
    });
  } catch (err) {
    console.error("Reduce error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* =====================================================
   DELETE CODE (removes Pro from all devices)
   ===================================================== */
router.delete("/codes/:code", requireAdmin, async (req, res) => {
  try {
    const codeUpper = req.params.code.toUpperCase();
    const codeDoc = await Code.findOne({ code: codeUpper });

    if (codeDoc) {
      await Device.updateMany(
        { lastCode: codeUpper },
        {
          isPro: false,
          proExpiry: null,
          lastCode: null
        }
      );
    }

    await Code.deleteOne({ code: codeUpper });
    res.json({
      ok: true,
      removedFromDevices: codeDoc ? codeDoc.usedBy.length : 0
    });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* =====================================================
   SERVER MANAGEMENT
   ===================================================== */

/* GET all servers */
router.get("/servers", requireAdmin, async (req, res) => {
  try {
    const servers = await Server.find().sort({ priority: -1, name: 1 });
    res.json({ ok: true, servers });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* ADD new server */
router.post("/servers", requireAdmin, async (req, res) => {
  try {
    const {
      code, name, city, host, port = 1080,
      scheme = "socks5", username = "", password = "",
      isPremium = false, priority = 0
    } = req.body;

    // Validate
    if (!code || !name || !city || !host) {
      return res.status(400).json({ ok: false, error: "code, name, city, host required" });
    }

    const cleanCode = code.toLowerCase().trim();

    // Check duplicate
    const exists = await Server.findOne({ code: cleanCode });
    if (exists) {
      return res.status(400).json({ ok: false, error: "Server code already exists" });
    }

    const server = await Server.create({
      code: cleanCode,
      name: name.trim(),
      city: city.trim(),
      host: host.trim(),
      port: parseInt(port),
      scheme,
      username,
      password,
      isPremium,
      priority: parseInt(priority)
    });

    res.json({ ok: true, server });
  } catch (err) {
    console.error("Add server error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* UPDATE server */
router.put("/servers/:code", requireAdmin, async (req, res) => {
  try {
    const code = req.params.code.toLowerCase();
    const updates = req.body;

    // Don't allow code change
    delete updates._id;
    delete updates.code;

    const server = await Server.findOneAndUpdate(
      { code },
      { $set: updates },
      { new: true }
    );

    if (!server) {
      return res.status(404).json({ ok: false, error: "Server not found" });
    }

    res.json({ ok: true, server });
  } catch (err) {
    console.error("Update server error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* TOGGLE free/pro */
router.post("/servers/:code/toggle-premium", requireAdmin, async (req, res) => {
  try {
    const code = req.params.code.toLowerCase();
    const server = await Server.findOne({ code });
    if (!server) return res.status(404).json({ ok: false, error: "Server not found" });

    server.isPremium = !server.isPremium;
    await server.save();

    res.json({ ok: true, server });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* TOGGLE active */
router.post("/servers/:code/toggle-active", requireAdmin, async (req, res) => {
  try {
    const code = req.params.code.toLowerCase();
    const server = await Server.findOne({ code });
    if (!server) return res.status(404).json({ ok: false, error: "Server not found" });

    server.active = !server.active;
    await server.save();

    res.json({ ok: true, server });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* DELETE server */
router.delete("/servers/:code", requireAdmin, async (req, res) => {
  try {
    const code = req.params.code.toLowerCase();
    await Server.deleteOne({ code });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* =====================================================
   EXTEND DEVICES
   ===================================================== */
router.post("/extend-devices", requireAdmin, async (req, res) => {
  try {
    const { code, extraDevices } = req.body;

    if (!code || !extraDevices || extraDevices < 1) {
      return res.status(400).json({ ok: false, error: "Invalid input" });
    }

    const codeDoc = await Code.findOne({ code: code.toUpperCase() });
    if (!codeDoc) {
      return res.json({ ok: false, error: "Code not found" });
    }

    codeDoc.maxDevices = (codeDoc.maxDevices || 5) + parseInt(extraDevices);
    await codeDoc.save();

    res.json({
      ok: true,
      code: codeDoc.code,
      maxDevices: codeDoc.maxDevices,
      devicesUsed: codeDoc.usedBy.length
    });
  } catch (err) {
    console.error("Extend devices error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* =====================================================
   REDUCE DEVICES
   ===================================================== */
router.post("/reduce-devices", requireAdmin, async (req, res) => {
  try {
    const { code, reduceDevices } = req.body;

    if (!code || !reduceDevices || reduceDevices < 1) {
      return res.status(400).json({ ok: false, error: "Invalid input" });
    }

    const codeDoc = await Code.findOne({ code: code.toUpperCase() });
    if (!codeDoc) {
      return res.json({ ok: false, error: "Code not found" });
    }

    const minDevices = codeDoc.usedBy.length;  // Can't go below used count
    const newMax = Math.max(minDevices, (codeDoc.maxDevices || 5) - parseInt(reduceDevices));

    codeDoc.maxDevices = newMax;
    await codeDoc.save();

    res.json({
      ok: true,
      code: codeDoc.code,
      maxDevices: codeDoc.maxDevices,
      devicesUsed: codeDoc.usedBy.length,
      minimumAllowed: minDevices
    });
  } catch (err) {
    console.error("Reduce devices error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* =====================================================
   BANNER — GET
   ===================================================== */
const Banner = require("../models/Banner");

router.get("/banner", requireAdmin, async (req, res) => {
  try {
    let banner = await Banner.findOne({ id: "main" });
    if (!banner) {
      banner = await Banner.create({
        id: "main",
        active: false,
        icon: "📢",
        text: "",
        color: "red"
      });
    }
    res.json({ ok: true, banner });
  } catch (err) {
    console.error("Banner fetch error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* =====================================================
   BANNER — SAVE
   ===================================================== */
router.post("/banner", requireAdmin, async (req, res) => {
  try {
    const { active, icon, text, color } = req.body;

    let banner = await Banner.findOne({ id: "main" });
    if (!banner) {
      banner = new Banner({ id: "main" });
    }

    if (typeof active === "boolean") banner.active = active;
    if (icon !== undefined) banner.icon = icon;
    if (text !== undefined) banner.text = text;
    if (color !== undefined) banner.color = color;
    banner.updatedAt = new Date();

    await banner.save();

    res.json({ ok: true, banner });
  } catch (err) {
    console.error("Banner save error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;