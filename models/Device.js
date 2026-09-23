const mongoose = require("mongoose");

const DeviceSchema = new mongoose.Schema({
  deviceId:   { type: String, required: true, unique: true, index: true },
  ip:         { type: String, default: null },
  isPro:      { type: Boolean, default: false },
  proExpiry:  { type: Date, default: null },
  proCode:    { type: String, default: null },        // 6-digit personal code
  lastCode:   { type: String, default: null },        // user ne konsa code use kiya
  codeStart:  { type: Date, default: null },          // jab code use hua tha
  createdAt:  { type: Date, default: Date.now }
});

module.exports = mongoose.model("Device", DeviceSchema);