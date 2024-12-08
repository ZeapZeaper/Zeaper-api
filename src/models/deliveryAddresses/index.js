const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const DeliveryAddressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  address: { type: String, required: true },
  region: { type: String, required: true },
  country: { type: String, required: true },
  postCode: { type: String, required: false },
  phoneNumber: { type: String, required: true },
  isDefault: { type: Boolean, required: true, default: false },
  disabled: { type: Boolean, required: false, default: false },
});
DeliveryAddressSchema.plugin(timestamp);

const DeliveryAddressModel = mongoose.model(
  "DeliveryAddress",
  DeliveryAddressSchema,
  "DeliveryAddresses"
);

module.exports = DeliveryAddressModel;
