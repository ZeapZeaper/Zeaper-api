const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");
const { deliveryDetailsSchema } = require("../deliveryDetails");

const OrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  disabled: { type: Boolean, required: false, default: false },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: function () {
      return this.channel === "online";
    },
  },
  channel: {
    type: String,
    enum: ["online", "in-store"],
    default: "online",
    index: true,
  },
  inStoreCustomerDetails: {
    fullName: {
      type: String,
      required: false,
    },
    email: { type: String, required: false },
    phone: {
      type: String,
      required: false,
    },
    phoneNormalized: {
      type: String,
      required: false,
    },
    address: { type: String, required: false },
    region: { type: String, required: false },
    country: { type: String, required: false },
  },
  productOrders: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductOrders",
      required: false,
    },
  ],

  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Payments",
    required: true,
    unique: true,
  },
  deliveryDetails: {
    type: deliveryDetailsSchema,
    required: false,
  },
  gainedPoints: {
    type: Number,
    required: false,
    default: 0,
  },

  voucher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vouchers",
    required: false,
  },
  salesAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: function () {
      return this.channel === "in-store";
    },
  }, // staff who sold it
  storeLocation: { type: String, required: false, default: "Lagos" },
});

OrderSchema.plugin(timestamp);
OrderSchema.index({ orderId: 1 });
OrderSchema.index({ user: 1 });
OrderSchema.index({ channel: 1, createdAt: -1 });
OrderSchema.index({ channel: 1, "inStoreCustomerDetails.phoneNormalized": 1 });
OrderSchema.index({ salesAgent: 1 });

const OrderModel = mongoose.model("Orders", OrderSchema, "Orders");

module.exports = OrderModel;
