const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");


const PaymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  basket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Baskets",
    required: true,
  },
  status: {
    type: String,
    required: true,
    default: "pending",
  },

  amount: { type: Number, required: true },
  itemsTotal: { type: Number, required: true },
  deliveryFee: { type: Number, required: true },
  currency: { type: String, required: true },
  reference: { type: String, required: true, unique: true },
  appliedVoucherAmount: { type: Number, required: true },
  total: { type: Number, required: true },
  paidAt: { type: String, required: false },
  deliveryMethod: {
    type: String,
    required: false,
    enum: ["standard", "express"],
    default: "standard",
  },
  channel: { type: String, required: false },
  transactionDate: { type: String, required: false },
  cardType: { type: String, required: false },
  bank: { type: String, required: false },
  countryCode: { type: String, required: false },
  gatewayResponse: { type: String, required: false },
  fees: { type: Number, required: false },
  log: { type: Object, required: false },
});

PaymentSchema.plugin(timestamp);

const PaymentModel = mongoose.model("Payments", PaymentSchema, "Payments");

module.exports = PaymentModel;
