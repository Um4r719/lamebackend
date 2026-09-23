const mongoose = require("mongoose");

const ServerSchema = new mongoose.Schema({
  code:      { type: String, required: true, unique: true, lowercase: true },  // "de"
  name:      { type: String, required: true },     // "Germany"
  city:      { type: String, required: true },     // "Frankfurt"
  flag:      { type: String, default: "" },        // optional custom flag URL

  // Proxy / SSH details
  host:      { type: String, required: true },     // "de.proxy.lamevpn.app"
  port:      { type: Number, default: 1080 },
  scheme:    { type: String, default: "socks5" },  // "socks5" | "http" | "https"
  username:  { type: String, default: "" },
  password:  { type: String, default: "" },

  isPremium: { type: Boolean, default: false },    // Free or Pro
  active:    { type: Boolean, default: true },     // on/off
  priority:  { type: Number, default: 0 },         // sort order

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Server", ServerSchema);