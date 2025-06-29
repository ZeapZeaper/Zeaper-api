const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");
const { count } = require("../user");

const DeliveryFeeSchema = new mongoose.Schema(
  {
    fee: { type: Number, required: true },
    country: { type: String, required: true },
    currency: { type: String, required: true, default: "NGN" },
    method: {
      type: String,
      required: true,
      enum: ["standard", "express"],
      default: "standard",
    },
    freeDeliveryThreshold: {
      enabled: { type: Boolean, required: true, default: false },
      amount: { type: Number, required: true, default: 0 },
    },
    logs: [
      {
        type: {
          type: String,
          required: true,
          default: "delivery_fee_update",
          enum: ["delivery_fee_update", "free_delivery_threshold_update"],
        },
        value: { type: Number },
        date: { type: Date, required: true },
        currency: { type: String, required: true, default: "NGN" },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Users",
          required: true,
        },
        freeDeliveryThreshold: {
          enabled: { type: Boolean },
          amount: { type: Number },
        },
      },
    ],
  },
  {
    capped: { max: 1 },
  }
);
DeliveryFeeSchema.plugin(timestamp);

const DeliveryFeeModel = mongoose.model(
  "DeliveryFee",
  DeliveryFeeSchema,
  "DeliveryFee"
);

module.exports = DeliveryFeeModel;
