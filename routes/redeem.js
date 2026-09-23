const express = require("express");
const router = express.Router();
const Code = require("../models/Code");
const Device = require("../models/Device");

// ✅ 6-digit personal Pro code
function generatePersonalCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post("/", async (req, res) => {
  try {
    const { code, deviceId } = req.body;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";

    if (!code || !deviceId) {
      return res.status(400).json({ ok: false, error: "Code and deviceId required" });
    }

    const cleanCode = code.trim().toUpperCase();

    // Find code
    const codeDoc = await Code.findOne({ code: cleanCode });
    if (!codeDoc) {
      return res.json({ ok: false, error: "Invalid code" });
    }

    // Check if code is already expired
    const now = new Date();
    if (codeDoc.expiresAt && codeDoc.expiresAt.getTime() < now.getTime()) {
      return res.json({ ok: false, error: "Code expired" });
    }

    // Check if this device already used this code
    const alreadyUsed = codeDoc.usedBy.includes(deviceId);

    // If new device but limit reached → reject
    if (!alreadyUsed && codeDoc.usedBy.length >= codeDoc.maxDevices) {
      return res.json({
        ok: false,
        error: `Code full (${codeDoc.usedBy.length}/${codeDoc.maxDevices} devices)`
      });
    }

    // ✅ CRITICAL LOGIC: Set start date on FIRST use only
    if (!codeDoc.startedAt) {
      codeDoc.startedAt = now;
      codeDoc.expiresAt = new Date(now.getTime() + codeDoc.days * 24 * 60 * 60 * 1000);
    }

    // Register device if new
    if (!alreadyUsed) {
      codeDoc.usedBy.push(deviceId);
    }
    await codeDoc.save();

    // Find or create device
    let device = await Device.findOne({ deviceId });
    if (!device) {
      device = new Device({ deviceId, ip });
    }

    // ✅ CRITICAL: Device gets the SAME expiry as code (not new 30 days)
    device.isPro = true;
    device.proExpiry = codeDoc.expiresAt;      // ← same for all devices
    device.proCode = device.proCode || generatePersonalCode();
    device.lastCode = cleanCode;
    device.codeStart = codeDoc.startedAt;
    device.ip = ip;
    await device.save();

    // ✅ Calculate remaining days/hours for frontend
    const msRemaining = codeDoc.expiresAt.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.floor(msRemaining / (24 * 60 * 60 * 1000)));

    return res.json({
      ok: true,
      days: daysRemaining,                          // remaining days
      totalDays: codeDoc.days,                      // original duration
      expiry: codeDoc.expiresAt.toISOString(),
      startedAt: codeDoc.startedAt.toISOString(),
      proCode: device.proCode,
      codeUsed: cleanCode,                          // user ne ye code use kiya
      devicesUsed: codeDoc.usedBy.length,
      maxDevices: codeDoc.maxDevices
    });
  } catch (err) {
    console.error("Redeem error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;