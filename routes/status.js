const express = require("express");
const router = express.Router();
const Device = require("../models/Device");
const Code = require("../models/Code");

router.get("/", async (req, res) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId) {
      return res.status(400).json({ ok: false, error: "deviceId required" });
    }

    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.json({ ok: true, isPro: false });
    }

    const now = Date.now();
    const expired = device.proExpiry && device.proExpiry.getTime() < now;

    /* ✅ Auto-cleanup on expiry */
    if (expired && device.isPro) {
      device.isPro = false;
      device.proExpiry = null;
      await device.save();
    }

    /* ✅ Fetch code info + orphan check */
    let codeInfo = null;
    if (device.lastCode) {
      const codeDoc = await Code.findOne({ code: device.lastCode });

      if (codeDoc) {
        const msRemaining = codeDoc.expiresAt
          ? codeDoc.expiresAt.getTime() - now
          : 0;

        codeInfo = {
          codeUsed: codeDoc.code,
          totalDays: codeDoc.days,
          daysRemaining: Math.max(0, Math.floor(msRemaining / (24 * 60 * 60 * 1000))),
          startedAt: codeDoc.startedAt ? codeDoc.startedAt.toISOString() : null,
          expiresAt: codeDoc.expiresAt ? codeDoc.expiresAt.toISOString() : null,
          devicesUsed: codeDoc.usedBy.length,
          maxDevices: codeDoc.maxDevices
        };
      } else {
        /* ✅ Code deleted by admin → remove Pro */
        if (device.isPro || device.lastCode) {
          device.isPro = false;
          device.proExpiry = null;
          device.lastCode = null;
          await device.save();
        }
      }
    }

    return res.json({
      ok: true,
      isPro: device.isPro && !expired,
      expiry: device.proExpiry ? device.proExpiry.toISOString() : null,
      proCode: device.proCode,
      codeInfo
    });
  } catch (err) {
    console.error("Status error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;