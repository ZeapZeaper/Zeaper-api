const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const OrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  basketItems: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: { type: Number, required: true },
      sku: { type: String, required: true },
      measurements: [
        {
          name: { type: String, required: true },
          measurements: [
            {
              field: { type: String, required: true },
              value: { type: Number, required: true },
              unit: { type: String, required: true, value: "inch" },
            },
          ],
        },
      ],
    },
  ],
  status: {
    type: String,
    required: true,
    default: "pending",
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Payments",
    required: true,
  },
  deliveryAddress: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DeliveryAddresses",
    required: true,
  },
  deliveryDate: { type: String, required: false },
  deliveryTime: { type: String, required: false },
  deliveryFee: { type: Number, required: false },
  deliveryCompany: { type: String, required: false },
  deliveryTrackingNumber: { type: String, required: false },
  deliveryTrackingLink: { type: String, required: false },
  deliveryNote: { type: String, required: false },
  deliveryTimeRange: { type: String, required: false },
  shopOrders: [
    {
      basketItems: [
        {
          product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
          },
          quantity: { type: Number, required: true },
          sku: { type: String, required: true },
        },
      ],
      status: {
        type: String,
        required: true,
        default: "pending",
      },
      shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shops",
        required: true,
      },
    },
  ],
});

OrderSchema.plugin(timestamp);

const OrderModel = mongoose.model("Orders", OrderSchema, "Orders");

module.exports = OrderModel;
