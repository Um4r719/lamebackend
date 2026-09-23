const mongoose = require("mongoose");

const BannerSchema = new mongoose.Schema({
  id:        { type: String, default: "main", unique: true },
  active:    { type: Boolean, default: false },
  icon:      { type: String, default: "📢" },
  text:      { type: String, default: "" },
  color:     { type: String, default: "red" },   // red | yellow | green | blue
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Banner", BannerSchema);