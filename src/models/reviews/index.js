const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const ReviewSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  userId: { type: String, required: true },
  rating: { type: Number, required: true },
  review: { type: String, required: true },
  disabled: { type: Boolean, required: false, default: false },
  likes: { type: Number, required: false, default: 0 },
  dislikes: { type: Number, required: false, default: 0 },

  
});
ReviewSchema.plugin(timestamp);

const ReviewModel = mongoose.model("Reviews", ReviewSchema, "Reviews");

module.exports = ReviewModel;
