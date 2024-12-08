const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const BasketSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  basketId: { type: String, required: true },
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
  deliveryAddress: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DeliveryAddresses",
    required: false,
  },
});
BasketSchema.plugin(timestamp);

const BasketModel = mongoose.model("Baskets", BasketSchema, "Baskets");

module.exports = BasketModel;
