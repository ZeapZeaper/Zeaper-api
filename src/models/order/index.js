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
    },
  ],

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
});

OrderSchema.plugin(timestamp);

const OrderModel = mongoose.model("Orders", OrderSchema, "Orders");

module.exports = OrderModel;
