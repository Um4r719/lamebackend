const mongoose = require("mongoose");

const CodeSchema = new mongoose.Schema({
  code:       { type: String, required: true, unique: true, index: true },
  days:       { type: Number, default: 30 },         // ✅ fixed 30 days
  maxDevices: { type: Number, default: 5 },
  usedBy:     { type: [String], default: [] },
  startedAt:  { type: Date, default: null },          // ✅ pehli baar kab use hua
  expiresAt:  { type: Date, default: null },          // ✅ kab expire hoga
  createdAt:  { type: Date, default: Date.now }
});

module.exports = mongoose.model("Code", CodeSchema);