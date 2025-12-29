const { size } = require("lodash");
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const ReviewSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  product: {
     type: mongoose.Schema.Types.ObjectId,
     ref: "Product",
     required: true,
   },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
  orderId: { type: String, required: false },
  images: [
    {
      link: { type: String, required: true },
      name: { type: String, required: true },
    },
  ],
  color: { type: String, required: false },
  sku: { type: String, required: false },
  size: { type: String, required: false },
  deliveryDate: { type: String, required: false },
  rating: { type: Number, required: true },
  title: { type: String, required: true },
  review: { type: String, required: true },
  displayName: { type: String, required: true },
  disabled: { type: Boolean, required: false, default: false },
  fromAdmin: { type: Boolean, required: false, default: false },
  likes: {
    value: { type: Number, required: false, default: 0 },
    users: [{ type: mongoose.Schema.Types.ObjectId }],
  },
  dislikes: {
    value: { type: Number, required: false, default: 0 },
    users: [{ type: mongoose.Schema.Types.ObjectId }],
  },
  imageMatch: { type: Boolean, required: true },
});
ReviewSchema.plugin(timestamp);

const ReviewModel = mongoose.model("Reviews", ReviewSchema, "Reviews");

module.exports = ReviewModel;
