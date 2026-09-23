const express = require("express");
const router = express.Router();
const Device = require("../models/Device");
const Server = require("../models/Server");

/* GET /api/servers?deviceId=xxx */
router.get("/", async (req, res) => {
  try {
    const { deviceId } = req.query;
    let isPro = false;

    if (deviceId) {
      const device = await Device.findOne({ deviceId });
      if (device && device.isPro && device.proExpiry) {
        isPro = device.proExpiry.getTime() > Date.now();
      }
    }

    // Fetch active servers from DB
    const dbServers = await Server.find({ active: true })
      .sort({ priority: -1, name: 1 });

    // If DB is empty, return fallback
    if (dbServers.length === 0) {
      return res.json({
        ok: true,
        isPro,
        servers: getFallbackServers(isPro),
        freeCount: 5,
        proCount: 15
      });
    }

    // Map with locked status
    const servers = dbServers.map((s) => ({
      code: s.code,
      name: s.name,
      city: s.city,
      host: s.host,
      port: s.port,
      scheme: s.scheme,
      username: s.username,
      password: s.password,
      isPremium: s.isPremium,
      locked: s.isPremium && !isPro
    }));

    res.json({
      ok: true,
      isPro,
      servers,
      freeCount: servers.filter(s => !s.isPremium).length,
      proCount: servers.filter(s => s.isPremium).length
    });
  } catch (err) {
    console.error("Servers error:", err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* Fallback list if DB empty */
function getFallbackServers(isPro) {
  const list = [
    { code: "de", name: "Germany",        city: "Frankfurt", host: "de.proxy.lamevpn.app", port: 1080, scheme: "socks5", isPremium: false },
    { code: "us", name: "United States",  city: "New York",  host: "us.proxy.lamevpn.app", port: 1080, scheme: "socks5", isPremium: false },
    { code: "uk", name: "United Kingdom", city: "London",    host: "uk.proxy.lamevpn.app", port: 1080, scheme: "socks5", isPremium: false },
    { code: "fr", name: "France",         city: "Paris",     host: "fr.proxy.lamevpn.app", port: 1080, scheme: "socks5", isPremium: false },
    { code: "nl", name: "Netherlands",    city: "Amsterdam", host: "nl.proxy.lamevpn.app", port: 1080, scheme: "socks5", isPremium: false },
    { code: "jp", name: "Japan",          city: "Tokyo",     host: "jp.proxy.lamevpn.app", port: 1080, scheme: "socks5", isPremium: true },
    { code: "sg", name: "Singapore",      city: "SG1",       host: "sg.proxy.lamevpn.app", port: 1080, scheme: "socks5", isPremium: true },
    { code: "pk", name: "Pakistan",       city: "Karachi",   host: "pk.proxy.lamevpn.app", port: 1080, scheme: "socks5", isPremium: true }
  ];

  return list.map(s => ({ ...s, locked: s.isPremium && !isPro }));
}

module.exports = router;