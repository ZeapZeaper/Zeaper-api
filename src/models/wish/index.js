const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const WishSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  color: { type: String, required: true },
});

WishSchema.plugin(timestamp);

const WishModel = mongoose.model("Wishes", WishSchema, "Wishes");

module.exports = WishModel;
