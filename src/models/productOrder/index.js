const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const ProductOrderSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  orderId : { type: String, required: true },
  itemNo: { type: Number, required: true},
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shops",
    required: true,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: { type: Number, required: true },
  sku: { type: String, required: true },
  bespokeColor: { type: String, required: false },
  bodyMeasurements: [
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
  status: {
    type: String,
    required: true,
    default: "pending",
  },
  timeLines: [
    {
      date: { type: String, required: true },
      status: { type: String, required: true },
      description: { type: String, required: true },
      actionBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
        required: true,
      },
    },
  ],
  amount: { type: Number, required: true },
  promo: {
    promoId: { type: String, required: false },
    discountPercentage: { type: Number, required: false },
  },
  deliveryDate: { type: String, required: false },
  deliveryTime: { type: String, required: false },
  deliveryFee: { type: Number, required: false },
  deliveryCompany: { type: String, required: false },
  deliveryTrackingNumber: { type: String, required: false },
  deliveryTrackingLink: { type: String, required: false },
  deliveryNote: { type: String, required: false },
  deliveryTimeRange: { type: String, required: false },
});

ProductOrderSchema.plugin(timestamp);

const ProductOrderModel = mongoose.model( "ProductOrders", ProductOrderSchema, "ProductOrders");


module.exports = ProductOrderModel;