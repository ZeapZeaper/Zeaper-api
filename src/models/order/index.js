const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const OrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  disabled: { type: Boolean, required: false, default: false },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
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
  },
  deliveryAddress: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DeliveryAddress",
    required: true,
  },
  voucher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vouchers",
    required: false,
  },
});

OrderSchema.plugin(timestamp);

const OrderModel = mongoose.model("Orders", OrderSchema, "Orders");

module.exports = OrderModel;
