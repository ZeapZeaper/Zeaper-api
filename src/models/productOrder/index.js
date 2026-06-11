const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");
const { orderStatusEnums, currencyEnums } = require("../../helpers/constants");

const ProductOrderSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Orders",
    required: true,
  },
  disabled: { type: Boolean, required: false, default: false },
  orderId: { type: String, required: true },
  itemNo: { type: Number, required: true },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shops",
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: function () {
      return this.channel === "online";
    },
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  channel: {
    type: String,
    enum: ["online", "in-store"],
    default: "online",
    index: true,
  },
  quantity: { type: Number, required: true },
  sku: { type: String, required: true },
  barcode: { type: String, required: function () { return this.channel === "in-store"; } },
  size: { type: String, required: true },
  color: { type: String, required: true },
  images: [
    {
      link: { type: String, required: true },
      name: { type: String, required: true },
    },
  ],

  bespokeColor: { type: String, required: false },
  bespokeInstruction: { type: String, required: false },
  bodyMeasurements: [
    {
      name: { type: String, required: true },
      measurements: [
        {
          field: { type: String, required: true },
          value: { type: Number, required: true },
          unit: { type: String, value: "inch" },
        },
      ],
    },
  ],
  status: {
    name: {
      type: String,
      required: true,
      enum: orderStatusEnums.map((status) => status.name),
    },
    value: {
      type: String,
      required: true,
      enum: orderStatusEnums.map((status) => status.value),
    },
  },
  confirmedAt: { type: String, required: false },

  amount: [
    {
      currency: { type: String, required: true, enum: currencyEnums },
      value: { type: Number, required: true },
    },
  ],
  pricing: {
    unitPrice: Number, // actual charged (instore or online)
    basePrice: Number, // vendor original price
    discountApplied: Number, // if any
    pricingSource: {
      type: String,
      enum: ["online", "in-store"],
      default: "online",
    },
  },
  promo: {
    promoId: { type: String, required: false },
    discountPercentage: { type: Number, required: false },
  },
  expectedVendorCompletionDate: {
    min: { type: String, required: false },
    max: { type: String, required: false },
  },
  expectedDeliveryDate: {
    min: { type: String, required: false },
    max: { type: String, required: false },
  },
  deliveryMethod: {
    type: String,
    required: false,
    enum: ["standard", "express"],
    default: "standard",
  },
  deliveryDate: { type: String, required: false },
  deliveryFee: { type: Number, required: false },
  deliveryCompany: { type: String, required: false },
  deliveryTrackingNumber: { type: String, required: false },
  deliveryTrackingLink: { type: String, required: false },
  shopRevenue: {
    currency: {
      type: String,
      required: true,
      enum: currencyEnums,
      default: "NGN",
    },
    value: { type: Number, required: true },
    status: { type: String, required: false, default: "pending" },
    reference: { type: String, required: false },
    paidAt: { type: Date, required: false, default: null },
  },
  cancel: {
    isCancelled: { type: Boolean, required: false, default: false },
    cancelledAt: { type: Date, required: false },
    reason: { type: String, required: false },
    lastStatusBeforeCancel: {
      name: { type: String, required: false },
      value: { type: String, required: false },
    },
    cancelledBy: {
      type: String,
      required: false,
      enum: ["buyer", "seller", "admin", "system"],
      default: "buyer",
    },
  },
});

ProductOrderSchema.plugin(timestamp);
// add indexes to optimize queries
ProductOrderSchema.index({ order: 1 });
ProductOrderSchema.index({ user: 1 });
ProductOrderSchema.index({ shop: 1, createdAt: 1 });
ProductOrderSchema.index({ status: "text" });

const ProductOrderModel = mongoose.model(
  "ProductOrders",
  ProductOrderSchema,
  "ProductOrders",
);

module.exports = ProductOrderModel;
