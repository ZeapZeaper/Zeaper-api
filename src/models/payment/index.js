const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const PaymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: function () {
      return this.orderSource === "online";
    },
  },
  orderSource: {
    type: String,
    required: false,
    enum: ["online", "in-store"],
    default: "online",
  },
  salesAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: false,
  },
  fullName: {
    type: String,
    required: function () {
      return this.orderSource === "online";
    },
  },
  email: {
    type: String,
    required: function () {
      return this.orderSource === "online";
    },
    default: null,
  },
  basket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Baskets",
    required: function () {
      return this.orderSource === "online";
    },
  },
  status: {
    type: String,
    required: true,
    default: "pending",
  },
  gateway: { type: String, default: "" },
  deviceType: { type: String, required: false },
  amount: { type: Number, required: true },
  itemsTotal: { type: Number, required: true },
  deliveryFee: { type: Number, required: false, default: 0 },
  currency: { type: String, required: true },
  reference: { type: String, required: true, unique: true },
  stripeClientSecret: { type: String, required: false },
  stripePaymentIntentId: { type: String, required: false },
  appliedVoucherAmount: { type: Number, required: false, default: 0 },
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
// add indexes to optimize queries
PaymentSchema.index({ user: 1 });
PaymentSchema.index({ reference: 1 });

const PaymentModel = mongoose.model("Payments", PaymentSchema, "Payments");

module.exports = PaymentModel;
