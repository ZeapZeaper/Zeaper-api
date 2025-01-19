const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const DeliveryFeeSchema = new mongoose.Schema(
  {
    fee: { type: Number, required: true },
    default: { type: Boolean, required: true, default: false },
    currency: { type: String, required: true, default: "NGN" },
    logs: [
      {
        value: { type: Number, required: true },
        date: { type: Date, required: true },
        currency: { type: String, required: true, default: "NGN" },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Users",
          required: true,
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
